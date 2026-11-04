import {categoryPostings} from "./category-postings";
import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { format, subMonths } from "date-fns";
import { getDb } from "./db";
import { appSettings, budgetAlerts, budgets, categories, notificationPreferences, transactions, workspaces } from "./db/schema";
import { CURRENCIES, DEFAULT_CURRENCY_CODE, findCurrencyByCode } from "./currencies";
import { renderEmail } from "./email-template";
import { notifyWorkspace } from "./notify";
import { isPersonalLedger } from "./household-access";
import { localPersonalDb } from "./local-personal-db";

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

/** Prepare one monthly summary for households with an opt-in. Delivery checks each channel again. */
export async function sendMonthlyDigests(now = new Date()): Promise<number> {
  await localPersonalDb();
  const db = await getDb();
  const prev = subMonths(now, 1);
  const period = format(prev, "yyyy-MM");
  const monthName = format(prev, "MMMM yyyy");
  const { start, end } = monthRange(prev);
  const base = process.env.APP_URL || "";
  const symCache = new Map<string, string>();
  let sent = 0;

  const households = await db.selectDistinct({id:workspaces.id,name:workspaces.name}).from(workspaces)
    .innerJoin(notificationPreferences,and(eq(notificationPreferences.workspaceId,workspaces.id),eq(notificationPreferences.topic,"monthly")));
  for (const ws of households) {
    if (isPersonalLedger(ws.id)) continue;
    const [setting] = await db.select().from(appSettings).where(eq(appSettings.workspaceId, ws.id)).limit(1);
    if (setting?.lastDigestMonth === period || setting?.digestEnabled === false) continue;
    // Record immediately so an empty/failed month isn't retried forever.
    const claimed = await db.insert(appSettings).values({ workspaceId: ws.id, lastDigestMonth: period })
      .onConflictDoUpdate({ target: appSettings.workspaceId, set: { lastDigestMonth: period },
        setWhere: and(eq(appSettings.digestEnabled,true),sql`${appSettings.lastDigestMonth} IS DISTINCT FROM ${period}`) })
      .returning({id:appSettings.workspaceId});
    if (!claimed.length) continue;

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
      ? new Map((await db.select({ id: categories.id, name: categories.name }).from(categories).where(and(eq(categories.workspaceId,ws.id),inArray(categories.id, [...catSpend.keys()])))).map((c) => [c.id, c.name]))
      : new Map<string, string>();
    const top = [...catSpend.entries()].sort((a, b) => b[1] - a[1])[0];
    const biggest = txns.filter((t) => t.type === "expense").sort((a, b) => Number(b.amount) - Number(a.amount))[0];

    const url = "/?tab=analytics&range=month&date=" + start;
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
      cta: base ? { label: "Review this month", url: base + url } : undefined,
      footnote: "You selected the monthly digest in your household notification settings.",
    });
    const destinations = await notifyWorkspace(ws.id,{topic:"monthly",title:`Your ${monthName} in money`,body:"Your monthly summary is ready.",
      emailHtml:html,url,tag:"digest-" + ws.id + "-" + period});
    if (destinations) sent++;
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
    .from(budgets).innerJoin(categories, and(eq(budgets.categoryId, categories.id),eq(budgets.workspaceId,categories.workspaceId)));
  for (const b of rows) {
    if (isPersonalLedger(b.workspaceId)) continue;
    const budget = Number(b.amount);
    if (budget <= 0) continue;
    const postings=categoryPostings(db,undefined,true);
    const [agg] = await db.select({ spent: sql<number>`coalesce(sum(${postings.amount}), 0)` }).from(postings)
      .where(and(eq(postings.workspaceId, b.workspaceId), eq(postings.categoryId, b.categoryId), eq(postings.type, "expense"), gte(postings.date, start), lt(postings.date, end)));
    const spent = Number(agg?.spent ?? 0);
    const pct = (spent / budget) * 100;
    const crossed = pct >= 100 ? 100 : pct >= 80 ? 80 : 0;
    if (!crossed) continue;

    const seen = await db.select({ threshold: budgetAlerts.threshold }).from(budgetAlerts)
      .where(and(eq(budgetAlerts.workspaceId, b.workspaceId), eq(budgetAlerts.categoryId, b.categoryId), eq(budgetAlerts.period, period)));
    if (crossed <= seen.reduce((m, a) => Math.max(m, a.threshold), 0)) continue;

    const claimed = await db.insert(budgetAlerts).values({ workspaceId: b.workspaceId, categoryId: b.categoryId, period, threshold: crossed }).onConflictDoNothing().returning({ period: budgetAlerts.period });
    if (!claimed.length) continue;
    const sym = await symbolFor(db, b.workspaceId, symCache);
    await notifyWorkspace(b.workspaceId, {
      topic: "budget",
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
