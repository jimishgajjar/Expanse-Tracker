import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { getDb } from "./db";
import { accounts, appSettings, budgets, categories, transactions } from "./db/schema";
import { CURRENCIES, DEFAULT_CURRENCY_CODE, findCurrencyByCode } from "./currencies";

export type AccountDTO = {
  id: string; name: string; type: string; icon: string; color: string;
  initialBalance: number; income: number; expense: number; balance: number;
};
export type CategoryDTO = {
  id: string; name: string; kind: "income" | "expense"; icon: string; color: string;
};
export type RefDTO = { name: string; icon: string; color: string } | null;
export type TransactionDTO = {
  id: string; type: "income" | "expense"; amount: number; date: string; note: string;
  accountId: string | null; categoryId: string | null; account: RefDTO; category: RefDTO;
};

export async function getCategories(): Promise<CategoryDTO[]> {
  const db = await getDb();
  const rows = await db.select().from(categories).orderBy(asc(categories.name));
  return rows.map((c) => ({ id: c.id, name: c.name, kind: c.kind, icon: c.icon, color: c.color }));
}

/** Accounts with current balance = initial + all income − all expense. */
export async function getAccountsWithBalances(): Promise<AccountDTO[]> {
  const db = await getDb();
  const accs = await db.select().from(accounts).orderBy(asc(accounts.createdAt));
  const agg = await db
    .select({
      accountId: transactions.accountId,
      type: transactions.type,
      total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .groupBy(transactions.accountId, transactions.type);

  const byId: Record<string, { income: number; expense: number }> = {};
  for (const r of agg) {
    if (!r.accountId) continue;
    (byId[r.accountId] ??= { income: 0, expense: 0 })[r.type] += Number(r.total ?? 0);
  }
  return accs.map((a) => {
    const m = byId[a.id] ?? { income: 0, expense: 0 };
    const initialBalance = Number(a.initialBalance);
    return {
      id: a.id, name: a.name, type: a.type, icon: a.icon, color: a.color,
      initialBalance, income: m.income, expense: m.expense,
      balance: initialBalance + m.income - m.expense,
    };
  });
}

/** All transactions whose date is in [start, end), newest first, with refs joined. */
export async function getTransactionsInRange(start: string, end: string): Promise<TransactionDTO[]> {
  const db = await getDb();
  const rows = await db.query.transactions.findMany({
    where: and(gte(transactions.date, start), lt(transactions.date, end)),
    orderBy: [desc(transactions.date), desc(transactions.createdAt)],
    with: { account: true, category: true },
  });
  return rows.map((t) => ({
    id: t.id, type: t.type, amount: Number(t.amount), date: t.date, note: t.note,
    accountId: t.accountId, categoryId: t.categoryId,
    account: t.account ? { name: t.account.name, icon: t.account.icon, color: t.account.color } : null,
    category: t.category ? { name: t.category.name, icon: t.category.icon, color: t.category.color } : null,
  }));
}

/** Every transaction (used by the Excel export). */
export async function getAllTransactions(): Promise<TransactionDTO[]> {
  return getTransactionsInRange("0001-01-01", "9999-12-31");
}

export type SettingsDTO = { currencyCode: string; currency: string; locale: string };

/** App settings, creating the single row with defaults on first read. */
export async function getSettings(): Promise<SettingsDTO> {
  const db = await getDb();
  let rows = await db.select().from(appSettings).where(eq(appSettings.id, "app"));
  if (!rows.length) rows = await db.insert(appSettings).values({ id: "app" }).returning();
  const cur = findCurrencyByCode(rows[0]?.currencyCode ?? DEFAULT_CURRENCY_CODE) ?? CURRENCIES[0];
  return { currencyCode: cur.code, currency: cur.symbol, locale: cur.locale };
}

// ── budgets ──────────────────────────────────────────────
export type BudgetProgressDTO = { categoryId: string; name: string; icon: string; color: string; budget: number; spent: number };

/** Budgets (one per expense category) with this calendar month's spend. */
export async function getBudgetProgress(): Promise<BudgetProgressDTO[]> {
  const db = await getDb();
  const rows = await db
    .select({ categoryId: budgets.categoryId, amount: budgets.amount, name: categories.name, icon: categories.icon, color: categories.color })
    .from(budgets)
    .innerJoin(categories, eq(budgets.categoryId, categories.id));
  if (!rows.length) return [];

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const start = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  const nx = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const end = `${nx.getFullYear()}-${pad(nx.getMonth() + 1)}-01`;

  const spendRows = await db
    .select({ categoryId: transactions.categoryId, total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
    .from(transactions)
    .where(and(eq(transactions.type, "expense"), gte(transactions.date, start), lt(transactions.date, end)))
    .groupBy(transactions.categoryId);
  const spent: Record<string, number> = {};
  for (const r of spendRows) if (r.categoryId) spent[r.categoryId] = Number(r.total);

  return rows
    .map((r) => ({ categoryId: r.categoryId, name: r.name, icon: r.icon, color: r.color, budget: Number(r.amount), spent: spent[r.categoryId] ?? 0 }))
    .sort((a, b) => b.spent / b.budget - a.spent / a.budget);
}

/** Income + expense totals over a [start, end) range (for period comparison). */
export async function getRangeTotals(start: string, end: string): Promise<{ income: number; expense: number }> {
  const db = await getDb();
  const rows = await db
    .select({ type: transactions.type, total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
    .from(transactions)
    .where(and(gte(transactions.date, start), lt(transactions.date, end)))
    .groupBy(transactions.type);
  let income = 0, expense = 0;
  for (const r of rows) { if (r.type === "income") income = Number(r.total); else expense = Number(r.total); }
  return { income, expense };
}

export type NetWorthPoint = { key: string; value: number };

/** Cumulative net worth at the end of each month (initial balances + running income−expense). */
export async function getNetWorthSeries(): Promise<NetWorthPoint[]> {
  const db = await getDb();
  const accs = await db.select({ initial: accounts.initialBalance }).from(accounts);
  const base = accs.reduce((s, a) => s + Number(a.initial), 0);
  const rows = await db
    .select({
      ym: sql<string>`to_char(${transactions.date}, 'YYYY-MM')`,
      delta: sql<string>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amount} else -${transactions.amount} end), 0)`,
    })
    .from(transactions)
    .groupBy(sql`to_char(${transactions.date}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${transactions.date}, 'YYYY-MM')`);
  let running = base;
  return rows.map((r) => ({ key: r.ym, value: (running += Number(r.delta)) }));
}
