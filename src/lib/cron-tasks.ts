import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { format, subMonths } from "date-fns";
import { getDb } from "./db";
import { appSettings, budgetAlerts, budgets, categories, transactions, users, workspaceMembers, workspaces } from "./db/schema";
import { CURRENCIES, DEFAULT_CURRENCY_CODE, findCurrencyByCode } from "./currencies";
import { renderEmail } from "./email-template";
import { sendEmail } from "./email";
import { notifyWorkspace } from "./notify";

const pad = (n: number) => String(n).padStart(2, "0");
function monthRange(d: Date) {
  const start = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
  const nx = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return { start, end: `${nx.getFullYear()}-${pad(nx.getMonth() + 1)}-01` };
}
type DB = Awaited<ReturnType<typeof getDb>>;
async function symbolFor(db: DB, wsId: string, cache: Map<string, string>): Promise<string> {
  const hit = cache.get(wsId);
  if (hit) return hit;
  const [s] = await db.select({ code: appSettings.currencyCode }).from(appSettings).where(eq(appSettings.workspaceId, wsId)).limit(1);
  const sym = (findCurrencyByCode(s?.code ?? DEFAULT_CURRENCY_CODE) ?? CURRENCIES[0]).symbol;
  cache.set(wsId, sym);
  return sym;
}

/** Email each workspace a "your month in money" summary, once per month. */
export async function sendMonthlyDigests(now = new Date()): Promise<number> {
  const db = await getDb();
  const prev = subMonths(now, 1);
  const period = format(prev, "yyyy-MM");
  const monthName = format(prev, "MMMM yyyy");
  const { start, end } = monthRange(prev);
  const base = process.env.APP_URL || "";
  const symCache = new Map<string, string>();
  let sent = 0;

  for (const ws of await db.select().from(workspaces)) {
    const [setting] = await db.select().from(appSettings).where(eq(appSettings.workspaceId, ws.id)).limit(1);
    if (setting?.lastDigestMonth === period || setting?.digestEnabled === false) continue;
    // Record immediately so an empty/failed month isn't retried forever.
    await db.insert(appSettings).values({ workspaceId: ws.id, lastDigestMonth: period })
      .onConflictDoUpdate({ target: appSettings.workspaceId, set: { lastDigestMonth: period } });

    const txns = await db.select().from(transactions)
      .where(and(eq(transactions.workspaceId, ws.id), gte(transactions.date, start), lt(transactions.date, end)));
    if (!txns.length) continue;

    const sym = await symbolFor(db, ws.id, symCache);
    const fmt = (n: number) => `${sym}${n.toFixed(2)}`;
    const income = txns.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const expense = txns.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
    const net = income - expense;

    const catSpend = new Map<string, number>();
    for (const t of txns) if (t.type === "expense" && t.categoryId) catSpend.set(t.categoryId, (catSpend.get(t.categoryId) ?? 0) + Number(t.amount));
    const names = catSpend.size
      ? new Map((await db.select({ id: categories.id, name: categories.name }).from(categories).where(inArray(categories.id, [...catSpend.keys()]))).map((c) => [c.id, c.name]))
      : new Map<string, string>();
    const top = [...catSpend.entries()].sort((a, b) => b[1] - a[1])[0];
    const biggest = txns.filter((t) => t.type === "expense").sort((a, b) => Number(b.amount) - Number(a.amount))[0];

    const html = renderEmail({
      heading: `Your ${monthName} in money`,
      intro: `Here's how "${ws.name}" did last month.`,
      detail: {
        amount: `${net < 0 ? "−" : "+"}${fmt(Math.abs(net))}`,
        tone: net < 0 ? "expense" : "income",
        rows: [
          { label: "Income", value: fmt(income) },
          { label: "Expenses", value: fmt(expense) },
          { label: "Net saved", value: fmt(net) },
          ...(top ? [{ label: "Top category", value: `${names.get(top[0]) ?? "Uncategorized"} · ${fmt(top[1])}` }] : []),
          ...(biggest ? [{ label: "Biggest expense", value: `${biggest.note || "—"} · ${fmt(Number(biggest.amount))}` }] : []),
        ],
      },
      cta: base ? { label: "Open Expense Tracker", url: `${base}/` } : undefined,
      footnote: "Your monthly summary from Expense Tracker.",
    });
    const members = await db.select({ email: users.email }).from(workspaceMembers).innerJoin(users, eq(workspaceMembers.userId, users.id)).where(eq(workspaceMembers.workspaceId, ws.id));
    await Promise.allSettled(members.map((m) => sendEmail(m.email, `Your ${monthName} in money`, html)));
    sent++;
  }
  return sent;
}

/** Notify when a category budget crosses 80% / 100% — once per threshold per month. */
export async function checkBudgetAlerts(now = new Date()): Promise<number> {
  const db = await getDb();
  const period = format(now, "yyyy-MM");
  const { start, end } = monthRange(now);
  const symCache = new Map<string, string>();
  let fired = 0;

  const rows = await db.select({ workspaceId: budgets.workspaceId, categoryId: budgets.categoryId, amount: budgets.amount, name: categories.name })
    .from(budgets).innerJoin(categories, eq(budgets.categoryId, categories.id));
  for (const b of rows) {
    const budget = Number(b.amount);
    if (budget <= 0) continue;
    const [agg] = await db.select({ spent: sql<number>`coalesce(sum(${transactions.amount}), 0)` }).from(transactions)
      .where(and(eq(transactions.workspaceId, b.workspaceId), eq(transactions.categoryId, b.categoryId), eq(transactions.type, "expense"), gte(transactions.date, start), lt(transactions.date, end)));
    const spent = Number(agg?.spent ?? 0);
    const pct = (spent / budget) * 100;
    const crossed = pct >= 100 ? 100 : pct >= 80 ? 80 : 0;
    if (!crossed) continue;

    const seen = await db.select({ threshold: budgetAlerts.threshold }).from(budgetAlerts)
      .where(and(eq(budgetAlerts.workspaceId, b.workspaceId), eq(budgetAlerts.categoryId, b.categoryId), eq(budgetAlerts.period, period)));
    if (crossed <= seen.reduce((m, a) => Math.max(m, a.threshold), 0)) continue;

    await db.insert(budgetAlerts).values({ workspaceId: b.workspaceId, categoryId: b.categoryId, period, threshold: crossed }).onConflictDoNothing();
    const sym = await symbolFor(db, b.workspaceId, symCache);
    await notifyWorkspace(b.workspaceId, {
      title: `Budget ${crossed >= 100 ? "exceeded" : "warning"}: ${b.name} ${Math.round(pct)}%`,
      body: `You've used ${sym}${spent.toFixed(2)} of your ${sym}${budget.toFixed(2)} ${b.name} budget.`,
      heading: crossed >= 100 ? `Over budget: ${b.name}` : `Budget warning: ${b.name}`,
      intro: `You've used ${Math.round(pct)}% of your ${b.name} budget this month.`,
      detail: { amount: `${sym}${spent.toFixed(2)}`, tone: "expense", rows: [{ label: "Budget", value: `${sym}${budget.toFixed(2)}` }, { label: "Used", value: `${Math.round(pct)}%` }] },
      ctaLabel: "Review spending",
      url: "/?tab=analytics",
      tag: `budget-${b.categoryId}-${period}-${crossed}`,
    });
    fired++;
  }
  return fired;
}
