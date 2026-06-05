import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { addMonths, addWeeks, addYears, differenceInCalendarDays, format, parseISO } from "date-fns";
import { getDb } from "./db";
import { accounts, appSettings, budgets, categories, invitations, recurring, transactions, transfers, users, workspaceMembers } from "./db/schema";
import { CURRENCIES, DEFAULT_CURRENCY_CODE, findCurrencyByCode } from "./currencies";
import { todayISO } from "./dates";
import { getActiveWorkspaceId } from "./workspace";
import { notifyWorkspace } from "./notify";

export type AccountDTO = {
  id: string; name: string; type: string; icon: string; color: string;
  initialBalance: number; income: number; expense: number; balance: number;
};
export type CategoryDTO = { id: string; name: string; kind: "income" | "expense"; icon: string; color: string };
export type RefDTO = { name: string; icon: string; color: string } | null;
export type TransactionDTO = {
  id: string; type: "income" | "expense"; amount: number; date: string; note: string;
  accountId: string | null; categoryId: string | null; account: RefDTO; category: RefDTO;
  createdByName: string | null;
};
export type TransferDTO = { id: string; amount: number; date: string; note: string; fromAccountId: string; toAccountId: string };
export type RecurringDTO = {
  id: string; type: "income" | "expense"; amount: number; note: string;
  accountId: string | null; categoryId: string | null; frequency: string; nextDate: string;
  endDate: string | null; maxOccurrences: number | null; occurrenceCount: number;
  alertsEnabled: boolean; remindDaysBefore: number;
};
export type SettingsDTO = { currencyCode: string; currency: string; locale: string };
export type BudgetProgressDTO = { categoryId: string; name: string; icon: string; color: string; budget: number; spent: number };
export type NetWorthPoint = { key: string; value: number };
export type MemberDTO = { id: string; email: string; name: string; role: string };

export async function getCategories(): Promise<CategoryDTO[]> {
  const wid = await getActiveWorkspaceId();
  if (!wid) return [];
  const db = await getDb();
  const rows = await db.select().from(categories).where(eq(categories.workspaceId, wid)).orderBy(asc(categories.name));
  return rows.map((c) => ({ id: c.id, name: c.name, kind: c.kind, icon: c.icon, color: c.color }));
}

/** Accounts with current balance = initial + income − expense + transfers. */
export async function getAccountsWithBalances(): Promise<AccountDTO[]> {
  const wid = await getActiveWorkspaceId();
  if (!wid) return [];
  const db = await getDb();
  const accs = await db.select().from(accounts).where(eq(accounts.workspaceId, wid)).orderBy(asc(accounts.createdAt));
  const agg = await db
    .select({ accountId: transactions.accountId, type: transactions.type, total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
    .from(transactions)
    .where(eq(transactions.workspaceId, wid))
    .groupBy(transactions.accountId, transactions.type);

  const byId: Record<string, { income: number; expense: number }> = {};
  for (const r of agg) {
    if (!r.accountId) continue;
    (byId[r.accountId] ??= { income: 0, expense: 0 })[r.type] += Number(r.total ?? 0);
  }
  const xfers = await db.select({ from: transfers.fromAccountId, to: transfers.toAccountId, amount: transfers.amount }).from(transfers).where(eq(transfers.workspaceId, wid));
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

export async function getTransfersInRange(start: string, end: string): Promise<TransferDTO[]> {
  const wid = await getActiveWorkspaceId();
  if (!wid) return [];
  const db = await getDb();
  const rows = await db
    .select()
    .from(transfers)
    .where(and(eq(transfers.workspaceId, wid), gte(transfers.date, start), lt(transfers.date, end)))
    .orderBy(desc(transfers.date), desc(transfers.createdAt));
  return rows.map((r) => ({ id: r.id, amount: Number(r.amount), date: r.date, note: r.note, fromAccountId: r.fromAccountId, toAccountId: r.toAccountId }));
}

// ── recurring ────────────────────────────────────────────
function advanceDate(dateStr: string, freq: string): string {
  const d = parseISO(dateStr);
  const next = freq === "weekly" ? addWeeks(d, 1) : freq === "yearly" ? addYears(d, 1) : addMonths(d, 1);
  return format(next, "yyyy-MM-dd");
}

type RecurringRow = typeof recurring.$inferSelect;

async function workspaceSymbol(db: Awaited<ReturnType<typeof getDb>>, cache: Map<string, string>, wsId: string): Promise<string> {
  const hit = cache.get(wsId);
  if (hit) return hit;
  const [s] = await db.select({ code: appSettings.currencyCode }).from(appSettings).where(eq(appSettings.workspaceId, wsId)).limit(1);
  const sym = (findCurrencyByCode(s?.code ?? DEFAULT_CURRENCY_CODE) ?? CURRENCIES[0]).symbol;
  cache.set(wsId, sym);
  return sym;
}

/** Post any due occurrences of these rules (respecting end date + repeat count),
 *  send a confirmation alert when one posts, and fire an "upcoming" reminder ahead
 *  of the next due date. Shared by the on-load and cron entry points. */
async function materialize(rules: RecurringRow[]): Promise<number> {
  if (!rules.length) return 0;
  const db = await getDb();
  const today = todayISO();
  const symCache = new Map<string, string>();
  let created = 0;

  for (const r of rules) {
    // 1) Catch up on everything due, stopping at the end date or max repetitions.
    let next = r.nextDate;
    let count = r.occurrenceCount;
    const toCreate: (typeof transactions.$inferInsert)[] = [];
    let guard = 0;
    while (next <= today && guard++ < 1000) {
      if (r.endDate && next > r.endDate) break;
      if (r.maxOccurrences != null && count >= r.maxOccurrences) break;
      toCreate.push({ workspaceId: r.workspaceId, type: r.type, amount: r.amount, date: next, note: r.note, accountId: r.accountId, categoryId: r.categoryId });
      count++;
      next = advanceDate(next, r.frequency);
    }
    if (toCreate.length) {
      await db.insert(transactions).values(toCreate);
      await db.update(recurring).set({ nextDate: next, occurrenceCount: count }).where(eq(recurring.id, r.id));
      created += toCreate.length;
      if (r.alertsEnabled) {
        const sym = await workspaceSymbol(db, symCache, r.workspaceId);
        const label = r.note || (r.type === "income" ? "Recurring income" : "Recurring payment");
        await notifyWorkspace(r.workspaceId, {
          title: `${r.type === "income" ? "Income added" : "Payment added"}: ${sym}${Number(r.amount).toFixed(2)}`,
          body: toCreate.length > 1 ? `${label} — ${toCreate.length} entries were added.` : `${label} was added to your tracker.`,
          url: "/?tab=transactions",
          tag: `posted-${r.id}`,
        });
      }
    }

    // 2) Remind ahead of the next due date — once per date (deduped via lastRemindedFor).
    const ended = (!!r.endDate && next > r.endDate) || (r.maxOccurrences != null && count >= r.maxOccurrences);
    if (r.alertsEnabled && !ended && r.lastRemindedFor !== next) {
      const daysUntil = differenceInCalendarDays(parseISO(next), parseISO(today));
      if (daysUntil >= 0 && daysUntil <= r.remindDaysBefore) {
        await db.update(recurring).set({ lastRemindedFor: next }).where(eq(recurring.id, r.id));
        const sym = await workspaceSymbol(db, symCache, r.workspaceId);
        const when = daysUntil === 0 ? "today" : daysUntil === 1 ? "tomorrow" : `in ${daysUntil} days`;
        const label = r.note || (r.type === "income" ? "income" : "payment");
        await notifyWorkspace(r.workspaceId, {
          title: `Upcoming ${r.type}: ${sym}${Number(r.amount).toFixed(2)}`,
          body: `${label} is scheduled for ${next} (${when}).`,
          url: "/",
          tag: `remind-${r.id}`,
        });
      }
    }
  }
  return created;
}

/** Materialise the active workspace's due recurring rules (called on dashboard load). */
export async function processRecurring(): Promise<void> {
  const wid = await getActiveWorkspaceId();
  if (!wid) return;
  const db = await getDb();
  await materialize(await db.select().from(recurring).where(eq(recurring.workspaceId, wid)));
}

/** Materialise every due recurring rule across all workspaces — for the cron job. */
export async function processAllRecurring(): Promise<number> {
  const db = await getDb();
  return materialize(await db.select().from(recurring));
}

export async function getRecurring(): Promise<RecurringDTO[]> {
  const wid = await getActiveWorkspaceId();
  if (!wid) return [];
  const db = await getDb();
  const rows = await db.select().from(recurring).where(eq(recurring.workspaceId, wid)).orderBy(asc(recurring.nextDate));
  return rows.map((r) => ({
    id: r.id, type: r.type, amount: Number(r.amount), note: r.note,
    accountId: r.accountId, categoryId: r.categoryId, frequency: r.frequency, nextDate: r.nextDate,
    endDate: r.endDate, maxOccurrences: r.maxOccurrences, occurrenceCount: r.occurrenceCount,
    alertsEnabled: r.alertsEnabled, remindDaysBefore: r.remindDaysBefore,
  }));
}

export async function getTransactionsInRange(start: string, end: string): Promise<TransactionDTO[]> {
  const wid = await getActiveWorkspaceId();
  if (!wid) return [];
  const db = await getDb();
  const rows = await db.query.transactions.findMany({
    where: and(eq(transactions.workspaceId, wid), gte(transactions.date, start), lt(transactions.date, end)),
    orderBy: [desc(transactions.date), desc(transactions.createdAt)],
    with: { account: true, category: true, creator: true },
  });
  return rows.map((t) => ({
    id: t.id, type: t.type, amount: Number(t.amount), date: t.date, note: t.note,
    accountId: t.accountId, categoryId: t.categoryId,
    account: t.account ? { name: t.account.name, icon: t.account.icon, color: t.account.color } : null,
    category: t.category ? { name: t.category.name, icon: t.category.icon, color: t.category.color } : null,
    createdByName: t.creator ? (t.creator.name || t.creator.email) : null,
  }));
}

export async function getAllTransactions(): Promise<TransactionDTO[]> {
  return getTransactionsInRange("0001-01-01", "9999-12-31");
}

export async function getMembers(): Promise<MemberDTO[]> {
  const wid = await getActiveWorkspaceId();
  if (!wid) return [];
  const db = await getDb();
  return db
    .select({ id: users.id, email: users.email, name: users.name, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(eq(workspaceMembers.workspaceId, wid))
    .orderBy(asc(workspaceMembers.createdAt));
}

export async function getInvites(): Promise<string[]> {
  const wid = await getActiveWorkspaceId();
  if (!wid) return [];
  const db = await getDb();
  const rows = await db.select({ email: invitations.email }).from(invitations).where(eq(invitations.workspaceId, wid)).orderBy(asc(invitations.createdAt));
  return rows.map((r) => r.email);
}

export async function getSettings(): Promise<SettingsDTO> {
  const fallback = () => {
    const c = findCurrencyByCode(DEFAULT_CURRENCY_CODE) ?? CURRENCIES[0];
    return { currencyCode: c.code, currency: c.symbol, locale: c.locale };
  };
  const wid = await getActiveWorkspaceId();
  if (!wid) return fallback();
  const db = await getDb();
  let rows = await db.select().from(appSettings).where(eq(appSettings.workspaceId, wid));
  if (!rows.length) rows = await db.insert(appSettings).values({ workspaceId: wid }).returning();
  const cur = findCurrencyByCode(rows[0]?.currencyCode ?? DEFAULT_CURRENCY_CODE) ?? CURRENCIES[0];
  return { currencyCode: cur.code, currency: cur.symbol, locale: cur.locale };
}

export async function getBudgetProgress(): Promise<BudgetProgressDTO[]> {
  const wid = await getActiveWorkspaceId();
  if (!wid) return [];
  const db = await getDb();
  const rows = await db
    .select({ categoryId: budgets.categoryId, amount: budgets.amount, name: categories.name, icon: categories.icon, color: categories.color })
    .from(budgets)
    .innerJoin(categories, eq(budgets.categoryId, categories.id))
    .where(eq(budgets.workspaceId, wid));
  if (!rows.length) return [];

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const start = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  const nx = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const end = `${nx.getFullYear()}-${pad(nx.getMonth() + 1)}-01`;

  const spendRows = await db
    .select({ categoryId: transactions.categoryId, total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
    .from(transactions)
    .where(and(eq(transactions.workspaceId, wid), eq(transactions.type, "expense"), gte(transactions.date, start), lt(transactions.date, end)))
    .groupBy(transactions.categoryId);
  const spent: Record<string, number> = {};
  for (const r of spendRows) if (r.categoryId) spent[r.categoryId] = Number(r.total);

  return rows
    .map((r) => ({ categoryId: r.categoryId, name: r.name, icon: r.icon, color: r.color, budget: Number(r.amount), spent: spent[r.categoryId] ?? 0 }))
    .sort((a, b) => b.spent / b.budget - a.spent / a.budget);
}

export async function getRangeTotals(start: string, end: string): Promise<{ income: number; expense: number }> {
  const wid = await getActiveWorkspaceId();
  if (!wid) return { income: 0, expense: 0 };
  const db = await getDb();
  const rows = await db
    .select({ type: transactions.type, total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
    .from(transactions)
    .where(and(eq(transactions.workspaceId, wid), gte(transactions.date, start), lt(transactions.date, end)))
    .groupBy(transactions.type);
  let income = 0, expense = 0;
  for (const r of rows) { if (r.type === "income") income = Number(r.total); else expense = Number(r.total); }
  return { income, expense };
}

export async function getNetWorthSeries(): Promise<NetWorthPoint[]> {
  const wid = await getActiveWorkspaceId();
  if (!wid) return [];
  const db = await getDb();
  const accs = await db.select({ initial: accounts.initialBalance }).from(accounts).where(eq(accounts.workspaceId, wid));
  const base = accs.reduce((s, a) => s + Number(a.initial), 0);
  const rows = await db
    .select({
      ym: sql<string>`to_char(${transactions.date}, 'YYYY-MM')`,
      delta: sql<string>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amount} else -${transactions.amount} end), 0)`,
    })
    .from(transactions)
    .where(eq(transactions.workspaceId, wid))
    .groupBy(sql`to_char(${transactions.date}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${transactions.date}, 'YYYY-MM')`);
  let running = base;
  return rows.map((r) => ({ key: r.ym, value: (running += Number(r.delta)) }));
}
