import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { addMonths, addWeeks, addYears, format, parseISO } from "date-fns";
import { getDb } from "./db";
import { accounts, appSettings, budgets, categories, recurring, transactions, transfers } from "./db/schema";
import { CURRENCIES, DEFAULT_CURRENCY_CODE, findCurrencyByCode } from "./currencies";
import { todayISO } from "./dates";

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
  const xfers = await db.select({ from: transfers.fromAccountId, to: transfers.toAccountId, amount: transfers.amount }).from(transfers);
  const transferNet: Record<string, number> = {};
  for (const x of xfers) {
    const amt = Number(x.amount);
    transferNet[x.from] = (transferNet[x.from] ?? 0) - amt;
    transferNet[x.to] = (transferNet[x.to] ?? 0) + amt;
  }

  return accs.map((a) => {
    const m = byId[a.id] ?? { income: 0, expense: 0 };
    const initialBalance = Number(a.initialBalance);
    return {
      id: a.id, name: a.name, type: a.type, icon: a.icon, color: a.color,
      initialBalance, income: m.income, expense: m.expense,
      balance: initialBalance + m.income - m.expense + (transferNet[a.id] ?? 0),
    };
  });
}

export type TransferDTO = {
  id: string; amount: number; date: string; note: string;
  fromAccountId: string; toAccountId: string;
};

/** Transfers in a [start, end) range (account names resolved client-side). */
export async function getTransfersInRange(start: string, end: string): Promise<TransferDTO[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(transfers)
    .where(and(gte(transfers.date, start), lt(transfers.date, end)))
    .orderBy(desc(transfers.date), desc(transfers.createdAt));
  return rows.map((r) => ({
    id: r.id, amount: Number(r.amount), date: r.date, note: r.note,
    fromAccountId: r.fromAccountId, toAccountId: r.toAccountId,
  }));
}

// ── recurring ────────────────────────────────────────────
function advanceDate(dateStr: string, freq: string): string {
  const d = parseISO(dateStr);
  const next = freq === "weekly" ? addWeeks(d, 1) : freq === "yearly" ? addYears(d, 1) : addMonths(d, 1);
  return format(next, "yyyy-MM-dd");
}

/** Materialise any recurring rules that are due (nextDate ≤ today) into transactions. */
export async function processRecurring(): Promise<void> {
  const db = await getDb();
  const rules = await db.select().from(recurring);
  if (!rules.length) return;
  const today = todayISO();
  for (const r of rules) {
    let next = r.nextDate;
    const toCreate: (typeof transactions.$inferInsert)[] = [];
    let guard = 0;
    while (next <= today && guard++ < 500) {
      toCreate.push({ type: r.type, amount: r.amount, date: next, note: r.note, accountId: r.accountId, categoryId: r.categoryId });
      next = advanceDate(next, r.frequency);
    }
    if (toCreate.length) {
      await db.insert(transactions).values(toCreate);
      await db.update(recurring).set({ nextDate: next }).where(eq(recurring.id, r.id));
    }
  }
}

export type RecurringDTO = {
  id: string; type: "income" | "expense"; amount: number; note: string;
  accountId: string | null; categoryId: string | null; frequency: string; nextDate: string;
};

export async function getRecurring(): Promise<RecurringDTO[]> {
  const db = await getDb();
  const rows = await db.select().from(recurring).orderBy(asc(recurring.nextDate));
  return rows.map((r) => ({
    id: r.id, type: r.type, amount: Number(r.amount), note: r.note,
    accountId: r.accountId, categoryId: r.categoryId, frequency: r.frequency, nextDate: r.nextDate,
  }));
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
