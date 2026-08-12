// Aggregate analytics for the Insights tab.
//
// Everything here is READ-ONLY and derived from tables that already exist — no
// schema changes, no migrations. The rule each query follows: aggregate in
// Postgres and return tens of rows, never thousands. The dashboard already
// ships every transaction in the selected range to the client; these deeper
// views span up to a rolling year, so they must not do the same.

import { and, eq, gte, lt, sql } from "drizzle-orm";
import { addDays, addMonths, differenceInCalendarDays, format, getDaysInMonth, parseISO, startOfMonth } from "date-fns";
import { getDb } from "./db";
import { accounts, budgets, categories, transactions, users } from "./db/schema";
import { getActiveWorkspaceId } from "./workspace";
import { todayISO } from "./dates";

/** How far back the trailing views (category matrix, monthly bars) look. */
export const TRAILING_MONTHS = 12;
/** How many months of budget-vs-actual history to chart. */
export const BUDGET_HISTORY_MONTHS = 6;
/** Days of daily detail behind the heatmap / weekday / streak views. */
export const PATTERN_DAYS = 364; // 52 whole weeks — the heatmap grid is week-aligned

export type MonthTotal = { key: string; income: number; expense: number; net: number };

export type CategoryDelta = {
  categoryId: string | null;
  name: string;
  icon: string;
  color: string;
  kind: "income" | "expense";
  current: number;
  previous: number;
  count: number;
};

export type CategoryMonthly = {
  months: string[];
  series: { categoryId: string | null; name: string; icon: string; color: string; values: number[]; total: number }[];
};

export type BudgetPaceItem = {
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  budget: number;
  spent: number;
  projected: number;
};

export type BudgetAnalytics = {
  /** 1-based day of the current month, and its length — the basis for projection. */
  dayOfMonth: number;
  daysInMonth: number;
  totalBudget: number;
  totalSpent: number;
  totalProjected: number;
  items: BudgetPaceItem[];
  /** Actual spend per month against today's budget (budgets carry no history). */
  history: {
    months: string[];
    rows: { categoryId: string; name: string; icon: string; color: string; budget: number; values: number[] }[];
  };
};

export type DayTotal = { date: string; expense: number; income: number; count: number };

export type MemberSpend = { userId: string | null; name: string; expense: number; income: number; count: number };

export type AnalyticsData = {
  monthly: MonthTotal[];
  categoryDeltas: CategoryDelta[];
  /** True when a previous comparable period exists (false for the "all time" range). */
  hasPrevious: boolean;
  categoryMonthly: CategoryMonthly;
  budgets: BudgetAnalytics;
  daily: DayTotal[];
  members: MemberSpend[];
  /** Balance carried into the selected range — anchors the running-balance line. */
  openingBalance: number;
};

const monthStart = (key: string) => `${key}-01`;
const num = (v: unknown) => Number(v ?? 0);

/** The last `n` month keys (YYYY-MM), oldest first, ending with the current month. */
function trailingMonthKeys(n: number, today = new Date()): string[] {
  const base = startOfMonth(today);
  return Array.from({ length: n }, (_, i) => format(addMonths(base, i - (n - 1)), "yyyy-MM"));
}

/** Exclusive end date for a list of month keys. */
const endAfter = (keys: string[]) => format(addMonths(parseISO(monthStart(keys[keys.length - 1])), 1), "yyyy-MM-dd");

/** Income/expense per calendar month, gap-filled so months with no activity
 *  still occupy their slot (a missing month would otherwise compress the axis
 *  and misreport the slope of any line drawn through it). */
export async function getMonthlyTotals(months = TRAILING_MONTHS): Promise<MonthTotal[]> {
  const keys = trailingMonthKeys(months);
  const blank = (): MonthTotal[] => keys.map((key) => ({ key, income: 0, expense: 0, net: 0 }));
  const wid = await getActiveWorkspaceId();
  if (!wid) return blank();

  const db = await getDb();
  const rows = await db
    .select({
      ym: sql<string>`to_char(${transactions.date}, 'YYYY-MM')`,
      type: transactions.type,
      total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(and(eq(transactions.workspaceId, wid), gte(transactions.date, monthStart(keys[0])), lt(transactions.date, endAfter(keys))))
    .groupBy(sql`to_char(${transactions.date}, 'YYYY-MM')`, transactions.type);

  const byKey = new Map(blank().map((m) => [m.key, m]));
  for (const r of rows) {
    const m = byKey.get(r.ym);
    if (!m) continue;
    if (r.type === "income") m.income = num(r.total);
    else m.expense = num(r.total);
  }
  return [...byKey.values()].map((m) => ({ ...m, net: m.income - m.expense }));
}

type CatMeta = { name: string; icon: string; color: string };

async function categoryMeta(db: Awaited<ReturnType<typeof getDb>>, wid: string): Promise<Map<string, CatMeta>> {
  const rows = await db
    .select({ id: categories.id, name: categories.name, icon: categories.icon, color: categories.color })
    .from(categories)
    .where(eq(categories.workspaceId, wid));
  return new Map(rows.map((c) => [c.id, { name: c.name, icon: c.icon, color: c.color }]));
}

const UNCATEGORISED: CatMeta = { name: "Uncategorised", icon: "circle-help", color: "#9b9a97" };

async function totalsByCategory(db: Awaited<ReturnType<typeof getDb>>, wid: string, start: string, end: string) {
  return db
    .select({
      categoryId: transactions.categoryId,
      type: transactions.type,
      total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
      n: sql<string>`count(*)`,
    })
    .from(transactions)
    .where(and(eq(transactions.workspaceId, wid), gte(transactions.date, start), lt(transactions.date, end)))
    .groupBy(transactions.categoryId, transactions.type);
}

/** Per-category totals for the selected period alongside the one before it, so
 *  the UI can say "dining is up 40% on last month" rather than just showing a
 *  number with no reference point. */
export async function getCategoryDeltas(
  current: { start: string; end: string },
  previous: { start: string; end: string } | null,
): Promise<CategoryDelta[]> {
  const wid = await getActiveWorkspaceId();
  if (!wid) return [];
  const db = await getDb();

  const [meta, curRows, prevRows] = await Promise.all([
    categoryMeta(db, wid),
    totalsByCategory(db, wid, current.start, current.end),
    previous ? totalsByCategory(db, wid, previous.start, previous.end) : Promise.resolve([]),
  ]);

  // Keyed by category *and* type: a transaction carries its own income/expense
  // flavour, which is what the breakdown should reflect.
  const out = new Map<string, CategoryDelta>();
  const slot = (categoryId: string | null, kind: "income" | "expense") => {
    const key = `${categoryId ?? "none"}|${kind}`;
    let row = out.get(key);
    if (!row) {
      const m = (categoryId && meta.get(categoryId)) || UNCATEGORISED;
      row = { categoryId, name: m.name, icon: m.icon, color: m.color, kind, current: 0, previous: 0, count: 0 };
      out.set(key, row);
    }
    return row;
  };

  for (const r of curRows) {
    const row = slot(r.categoryId, r.type);
    row.current = num(r.total);
    row.count = num(r.n);
  }
  for (const r of prevRows) slot(r.categoryId, r.type).previous = num(r.total);

  return [...out.values()]
    .filter((r) => r.current > 0 || r.previous > 0)
    .sort((a, b) => b.current - a.current || b.previous - a.previous);
}

/** Expense per category per month over the trailing year — powers the sparklines
 *  and the category-mix-over-time view. */
export async function getCategoryMonthly(months = TRAILING_MONTHS): Promise<CategoryMonthly> {
  const keys = trailingMonthKeys(months);
  const wid = await getActiveWorkspaceId();
  if (!wid) return { months: keys, series: [] };

  const db = await getDb();
  const [meta, rows] = await Promise.all([
    categoryMeta(db, wid),
    db
      .select({
        categoryId: transactions.categoryId,
        ym: sql<string>`to_char(${transactions.date}, 'YYYY-MM')`,
        total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.workspaceId, wid),
          eq(transactions.type, "expense"),
          gte(transactions.date, monthStart(keys[0])),
          lt(transactions.date, endAfter(keys)),
        ),
      )
      .groupBy(transactions.categoryId, sql`to_char(${transactions.date}, 'YYYY-MM')`),
  ]);

  const index = new Map(keys.map((k, i) => [k, i]));
  const series = new Map<string, CategoryMonthly["series"][number]>();
  for (const r of rows) {
    const id = r.categoryId;
    const key = id ?? "none";
    let s = series.get(key);
    if (!s) {
      const m = (id && meta.get(id)) || UNCATEGORISED;
      s = { categoryId: id, name: m.name, icon: m.icon, color: m.color, values: keys.map(() => 0), total: 0 };
      series.set(key, s);
    }
    const i = index.get(r.ym);
    if (i === undefined) continue;
    s.values[i] = num(r.total);
    s.total += num(r.total);
  }

  return { months: keys, series: [...series.values()].sort((a, b) => b.total - a.total) };
}

/** Budget pace for the current month plus recent actuals per budgeted category.
 *
 *  Note: the `budgets` table stores one current amount per category with no
 *  history, so the history rows compare past actuals against *today's* budget.
 *  The UI labels it that way rather than implying the limit was always this. */
export async function getBudgetAnalytics(historyMonths = BUDGET_HISTORY_MONTHS): Promise<BudgetAnalytics> {
  const today = parseISO(todayISO());
  const dayOfMonth = today.getDate();
  const daysInMonth = getDaysInMonth(today);
  const empty: BudgetAnalytics = {
    dayOfMonth,
    daysInMonth,
    totalBudget: 0,
    totalSpent: 0,
    totalProjected: 0,
    items: [],
    history: { months: trailingMonthKeys(historyMonths, today), rows: [] },
  };

  const wid = await getActiveWorkspaceId();
  if (!wid) return empty;
  const db = await getDb();

  const limits = await db
    .select({
      categoryId: budgets.categoryId,
      amount: budgets.amount,
      name: categories.name,
      icon: categories.icon,
      color: categories.color,
    })
    .from(budgets)
    .innerJoin(categories, eq(budgets.categoryId, categories.id))
    .where(eq(budgets.workspaceId, wid));
  if (!limits.length) return empty;

  const keys = trailingMonthKeys(historyMonths, today);
  const rows = await db
    .select({
      categoryId: transactions.categoryId,
      ym: sql<string>`to_char(${transactions.date}, 'YYYY-MM')`,
      total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.workspaceId, wid),
        eq(transactions.type, "expense"),
        gte(transactions.date, monthStart(keys[0])),
        lt(transactions.date, endAfter(keys)),
      ),
    )
    .groupBy(transactions.categoryId, sql`to_char(${transactions.date}, 'YYYY-MM')`);

  const index = new Map(keys.map((k, i) => [k, i]));
  const thisMonth = format(startOfMonth(today), "yyyy-MM");
  const spendByCat = new Map<string, number[]>();
  for (const r of rows) {
    if (!r.categoryId) continue;
    const i = index.get(r.ym);
    if (i === undefined) continue;
    const arr = spendByCat.get(r.categoryId) ?? keys.map(() => 0);
    arr[i] = num(r.total);
    spendByCat.set(r.categoryId, arr);
  }

  const currentIdx = index.get(thisMonth) ?? keys.length - 1;
  // Straight-line projection: today's burn rate held for the rest of the month.
  const project = (spent: number) => (dayOfMonth > 0 ? (spent / dayOfMonth) * daysInMonth : spent);

  const items: BudgetPaceItem[] = limits
    .map((l) => {
      const spent = spendByCat.get(l.categoryId)?.[currentIdx] ?? 0;
      return {
        categoryId: l.categoryId,
        name: l.name,
        icon: l.icon,
        color: l.color,
        budget: num(l.amount),
        spent,
        projected: project(spent),
      };
    })
    .sort((a, b) => b.projected / (b.budget || 1) - a.projected / (a.budget || 1));

  const totalSpent = items.reduce((s, i) => s + i.spent, 0);
  return {
    dayOfMonth,
    daysInMonth,
    totalBudget: items.reduce((s, i) => s + i.budget, 0),
    totalSpent,
    totalProjected: project(totalSpent),
    items,
    history: {
      months: keys,
      rows: limits.map((l) => ({
        categoryId: l.categoryId,
        name: l.name,
        icon: l.icon,
        color: l.color,
        budget: num(l.amount),
        values: spendByCat.get(l.categoryId) ?? keys.map(() => 0),
      })),
    },
  };
}

/** One row per day over the trailing year, gap-filled. Small enough to ship
 *  (≤364 rows) and it serves the heatmap, the weekday profile and the
 *  no-spend-streak counter from a single query. */
export async function getDailyTotals(days = PATTERN_DAYS): Promise<DayTotal[]> {
  const today = parseISO(todayISO());
  const start = addDays(today, -(days - 1));
  const keys = Array.from({ length: days }, (_, i) => format(addDays(start, i), "yyyy-MM-dd"));
  const blank = (): DayTotal[] => keys.map((date) => ({ date, expense: 0, income: 0, count: 0 }));

  const wid = await getActiveWorkspaceId();
  if (!wid) return blank();

  const db = await getDb();
  const rows = await db
    .select({
      date: transactions.date,
      type: transactions.type,
      total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
      n: sql<string>`count(*)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.workspaceId, wid),
        gte(transactions.date, keys[0]),
        lt(transactions.date, format(addDays(today, 1), "yyyy-MM-dd")),
      ),
    )
    .groupBy(transactions.date, transactions.type);

  const byDate = new Map(blank().map((d) => [d.date, d]));
  for (const r of rows) {
    const d = byDate.get(r.date);
    if (!d) continue;
    if (r.type === "income") d.income = num(r.total);
    else d.expense = num(r.total);
    d.count += num(r.n);
  }
  return [...byDate.values()];
}

/** Who logged what in the selected range, via transactions.createdBy. Rows
 *  predating the multi-user work have a null author and fall under "Unknown". */
export async function getMemberSpend(start: string, end: string): Promise<MemberSpend[]> {
  const wid = await getActiveWorkspaceId();
  if (!wid) return [];
  const db = await getDb();
  const rows = await db
    .select({
      userId: transactions.createdBy,
      name: users.name,
      email: users.email,
      type: transactions.type,
      total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
      n: sql<string>`count(*)`,
    })
    .from(transactions)
    .leftJoin(users, eq(transactions.createdBy, users.id))
    .where(and(eq(transactions.workspaceId, wid), gte(transactions.date, start), lt(transactions.date, end)))
    .groupBy(transactions.createdBy, users.name, users.email, transactions.type);

  const out = new Map<string, MemberSpend>();
  for (const r of rows) {
    const key = r.userId ?? "none";
    const row = out.get(key) ?? {
      userId: r.userId,
      name: r.name || r.email || "Unknown",
      expense: 0,
      income: 0,
      count: 0,
    };
    if (r.type === "income") row.income = num(r.total);
    else row.expense = num(r.total);
    row.count += num(r.n);
    out.set(key, row);
  }
  return [...out.values()].sort((a, b) => b.expense - a.expense);
}

/** Everything that happened before `before` — the balance the selected range
 *  opens on. Without this a running-balance line would have to start at zero
 *  (wrong) or at today's balance (wrong for any past period). */
export async function getOpeningBalance(before: string): Promise<number> {
  const wid = await getActiveWorkspaceId();
  if (!wid) return 0;
  const db = await getDb();
  const [seed] = await db
    .select({ total: sql<string>`coalesce(sum(${accounts.initialBalance}), 0)` })
    .from(accounts)
    .where(eq(accounts.workspaceId, wid));
  const [moved] = await db
    .select({
      delta: sql<string>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amount} else -${transactions.amount} end), 0)`,
    })
    .from(transactions)
    .where(and(eq(transactions.workspaceId, wid), lt(transactions.date, before)));
  // Transfers move money between accounts inside the workspace, so they net to
  // zero here and are deliberately left out.
  return num(seed?.total) + num(moved?.delta);
}

/** One call for the whole Insights tab — every query runs concurrently. */
export async function getAnalytics(
  current: { start: string; end: string },
  previous: { start: string; end: string } | null,
): Promise<AnalyticsData> {
  const [monthly, categoryDeltas, categoryMonthly, budgetData, daily, members, openingBalance] = await Promise.all([
    getMonthlyTotals(),
    getCategoryDeltas(current, previous),
    getCategoryMonthly(),
    getBudgetAnalytics(),
    getDailyTotals(),
    getMemberSpend(current.start, current.end),
    getOpeningBalance(current.start),
  ]);
  return {
    monthly,
    categoryDeltas,
    hasPrevious: previous !== null,
    categoryMonthly,
    budgets: budgetData,
    daily,
    members,
    openingBalance,
  };
}

/** Days between two ISO dates, inclusive — used for per-day averages. */
export const spanDays = (start: string, end: string) =>
  Math.max(1, differenceInCalendarDays(parseISO(end), parseISO(start)));
