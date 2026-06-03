import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { getDb } from "./db";
import { accounts, appSettings, categories, transactions } from "./db/schema";
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
