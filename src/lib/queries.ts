import { and, asc, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { addMonths, addWeeks, addYears, differenceInCalendarDays, format, parseISO, startOfMonth } from "date-fns";
import { postRecurringOccurrences } from "./recurring-posting";
import { getDb } from "./db";
import { accounts, appSettings, budgets, categories, goals, invitations, recurring, splits, tags, transactionTags, transactions, transfers, users, workspaceMembers } from "./db/schema";
import { CURRENCIES, DEFAULT_CURRENCY_CODE, findCurrencyByCode } from "./currencies";
import { todayISO } from "./dates";
import { getActiveWorkspaceId } from "./workspace";
import { getCurrentUser } from "./session";
import { computeBalances } from "./split-math";
import { notifyWorkspace, type Notice } from "./notify";

export type AccountDTO = {
  id: string; name: string; type: string; icon: string; color: string;
  initialBalance: number; income: number; expense: number; balance: number; archived: boolean;
};
export type CategoryDTO = { id: string; name: string; kind: "income" | "expense"; icon: string; color: string };
export type RefDTO = { name: string; icon: string; color: string } | null;
export type TagRef = { id: string; name: string; color: string };
export type TagDTO = { id: string; name: string; color: string; count: number };
export type TransactionDTO = {
  id: string; type: "income" | "expense"; amount: number; date: string; note: string;
  accountId: string | null; categoryId: string | null; account: RefDTO; category: RefDTO;
  createdByName: string | null; tags: TagRef[];
};
export type TransferDTO = { id: string; amount: number; date: string; note: string; fromAccountId: string; toAccountId: string };
export type RecurringDTO = {
  id: string; type: "income" | "expense"; amount: number; note: string;
  accountId: string | null; categoryId: string | null; frequency: string; nextDate: string;
  endDate: string | null; maxOccurrences: number | null; occurrenceCount: number;
  alertsEnabled: boolean; remindDaysBefore: number;
  commitmentType: string; autoPost: boolean; totalAmount: number | null;
  priceHistory: { amount: number; at: string }[];
};
export type SettingsDTO = { currencyCode: string; currency: string; locale: string };
export type BudgetProgressDTO = { categoryId: string; name: string; icon: string; color: string; budget: number; spent: number };
export type NetWorthPoint = { key: string; value: number };
export type MemberDTO = { id: string; email: string; name: string; role: string };
export type GoalDTO = { id: string; name: string; targetAmount: number; savedAmount: number; deadline: string | null; color: string };

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
      archived: a.archived,
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

/** Resolve an account/category name by id, cached, for alert email details. */
async function lookupName(db: Awaited<ReturnType<typeof getDb>>, cache: Map<string, string>, id: string | null, kind: "account" | "category"): Promise<string | null> {
  if (!id) return null;
  const key = `${kind}:${id}`;
  if (cache.has(key)) return cache.get(key) || null;
  const t = kind === "account" ? accounts : categories;
  const [row] = await db.select({ name: t.name }).from(t).where(eq(t.id, id)).limit(1);
  cache.set(key, row?.name ?? "");
  return row?.name ?? null;
}

/** A notification that materialising produced, ready to be sent. */
export type PendingNotice = { workspaceId: string; notice: Notice };

/** Send queued notifications. Sequential and best-effort — notifyWorkspace
 *  swallows its own failures, so one bad address can't stop the rest. */
export async function flushNotices(notices: PendingNotice[]): Promise<void> {
  for (const n of notices) await notifyWorkspace(n.workspaceId, n.notice);
}

/** Post any due occurrences of these rules (respecting end date + repeat count),
 *  queue a confirmation alert when one posts, and queue an "upcoming" reminder
 *  ahead of the next due date. Shared by the on-load and cron entry points.
 *
 *  Notifications are RETURNED rather than sent: each one fans out to email and
 *  web-push over the network, and on the dashboard render path that would block
 *  the page behind SMTP and FCM. Callers decide when to flush — the cron awaits
 *  them, the page defers them past the response with `after()`. */
async function materialize(rules: RecurringRow[]): Promise<{ created: number; notices: PendingNotice[] }> {
  const notices: PendingNotice[] = [];
  if (!rules.length) return { created: 0, notices };
  const db = await getDb();
  const today = todayISO();
  const symCache = new Map<string, string>();
  const nameCache = new Map<string, string>();
  let created = 0;

  for (const r of rules) {
    // 1) Catch up on everything due, stopping at the end date or max repetitions.
    let next = r.nextDate;
    let count = r.occurrenceCount;
    const toCreate: (typeof transactions.$inferInsert)[] = [];
    let advanced = false;
    let guard = 0;
    while (next <= today && guard++ < 1000) {
      if (r.endDate && next > r.endDate) break;
      if (r.maxOccurrences != null && count >= r.maxOccurrences) break;
      // Variable bills (autoPost = false) advance the schedule but don't post a guessed amount.
      if (r.autoPost) toCreate.push({ workspaceId: r.workspaceId, type: r.type, amount: r.amount, date: next, note: r.note, accountId: r.accountId, categoryId: r.categoryId });
      count++;
      advanced = true;
      next = advanceDate(next, r.frequency);
    }
    if (advanced) {
      const claimed = await postRecurringOccurrences(db, r, next, count, toCreate);
      if (!claimed) continue;
      created += toCreate.length;
      if (r.alertsEnabled && toCreate.length) {
        const sym = await workspaceSymbol(db, symCache, r.workspaceId);
        const label = r.note || (r.type === "income" ? "Recurring income" : "Recurring payment");
        const accName = await lookupName(db, nameCache, r.accountId, "account");
        const catName = await lookupName(db, nameCache, r.categoryId, "category");
        const amountStr = `${sym}${Number(r.amount).toFixed(2)}`;
        const lastDate = format(parseISO(toCreate[toCreate.length - 1].date as string), "MMM d, yyyy");
        notices.push({ workspaceId: r.workspaceId, notice: {
          title: `${r.type === "income" ? "Income added" : "Payment added"}: ${amountStr}`,
          body: toCreate.length > 1 ? `${label} — ${toCreate.length} entries were added.` : `${label} was added to your tracker.`,
          heading: r.type === "income" ? "Income added" : "Payment added",
          intro: toCreate.length > 1
            ? `${toCreate.length} recurring entries just posted to your tracker.`
            : `This recurring ${r.type} just posted to your tracker.`,
          detail: {
            amount: `${r.type === "expense" ? "−" : "+"}${amountStr}`,
            tone: r.type,
            rows: [
              { label: "Item", value: label },
              ...(catName ? [{ label: "Category", value: catName }] : []),
              ...(accName ? [{ label: "Account", value: accName }] : []),
              { label: toCreate.length > 1 ? "Latest date" : "Date", value: lastDate },
            ],
          },
          ctaLabel: "View transaction",
          url: "/?tab=transactions",
          tag: `posted-${r.id}`,
        } });
      }
    }

    // 2) Remind ahead of the next due date — once per date (deduped via lastRemindedFor).
    const ended = (!!r.endDate && next > r.endDate) || (r.maxOccurrences != null && count >= r.maxOccurrences);
    if (r.alertsEnabled && !ended && r.lastRemindedFor !== next) {
      const daysUntil = differenceInCalendarDays(parseISO(next), parseISO(today));
      if (daysUntil >= 0 && daysUntil <= r.remindDaysBefore) {
        const claimed = await db.update(recurring).set({ lastRemindedFor: next })
          .where(and(eq(recurring.id, r.id), sql`${recurring.lastRemindedFor} IS DISTINCT FROM ${next}::date`)).returning({ id: recurring.id });
        if (!claimed.length) continue;
        const sym = await workspaceSymbol(db, symCache, r.workspaceId);
        const when = daysUntil === 0 ? "today" : daysUntil === 1 ? "tomorrow" : `in ${daysUntil} days`;
        const label = r.note || (r.type === "income" ? "Recurring income" : "Recurring payment");
        const accName = await lookupName(db, nameCache, r.accountId, "account");
        const catName = await lookupName(db, nameCache, r.categoryId, "category");
        const amountStr = `${sym}${Number(r.amount).toFixed(2)}`;
        const prettyNext = format(parseISO(next), "MMM d, yyyy");
        const remindOnly = !r.autoPost;
        notices.push({ workspaceId: r.workspaceId, notice: {
          title: remindOnly ? `Bill due: ${label}` : `Upcoming ${r.type}: ${amountStr}`,
          body: remindOnly ? `${label} is due ${prettyNext} (${when}) — log the amount you paid.` : `${label} is scheduled for ${prettyNext} (${when}).`,
          heading: remindOnly ? "Bill due — log it" : r.type === "income" ? "Upcoming income" : "Upcoming payment",
          intro: remindOnly
            ? `This bill is due ${when} (${prettyNext}). Log the actual amount once you've paid it.`
            : `Heads up — this is scheduled to post ${when} (${prettyNext}).`,
          detail: {
            amount: `${r.type === "expense" ? "−" : "+"}${amountStr}${remindOnly ? " est." : ""}`,
            tone: r.type,
            rows: [
              { label: "Item", value: label },
              ...(catName ? [{ label: "Category", value: catName }] : []),
              ...(accName ? [{ label: "Account", value: accName }] : []),
              { label: "When", value: `${when[0].toUpperCase()}${when.slice(1)} · ${prettyNext}` },
            ],
          },
          ctaLabel: remindOnly ? "Log payment" : "Review in app",
          url: remindOnly ? "/?tab=transactions" : "/",
          tag: `remind-${r.id}`,
        } });
      }
    }
  }
  return { created, notices };
}

/** Materialise the active workspace's due recurring rules (called on dashboard
 *  load). The DB writes stay on the render path so a charge that posts today is
 *  visible immediately; the returned notices are the caller's to send. */
export async function processRecurring(): Promise<PendingNotice[]> {
  const wid = await getActiveWorkspaceId();
  if (!wid) return [];
  const db = await getDb();
  const { notices } = await materialize(
    await db.select().from(recurring).where(eq(recurring.workspaceId, wid)),
  );
  return notices;
}

/** Materialise every due recurring rule across all workspaces — for the cron
 *  job, which has no response to block, so it sends the notices itself. */
export async function processAllRecurring(): Promise<number> {
  const db = await getDb();
  const { created, notices } = await materialize(await db.select().from(recurring));
  await flushNotices(notices);
  return created;
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
    commitmentType: r.commitmentType, autoPost: r.autoPost, totalAmount: r.totalAmount != null ? Number(r.totalAmount) : null,
    priceHistory: r.priceHistory ?? [],
  }));
}

export type SplitBalanceDTO = { userId: string; name: string; net: number };
export type SplitDTO = { id: string; note: string; creditorId: string; debtorId: string; amount: number };
export type SplitData = { meId: string; otherMembers: { id: string; name: string }[]; balances: SplitBalanceDTO[]; splits: SplitDTO[] };

export async function getSplitData(): Promise<SplitData> {
  const wid = await getActiveWorkspaceId();
  const me = await getCurrentUser();
  if (!wid || !me) return { meId: "", otherMembers: [], balances: [], splits: [] };
  const db = await getDb();
  const rows = await db.select().from(splits).where(and(eq(splits.workspaceId, wid), isNull(splits.settledAt))).orderBy(desc(splits.createdAt));
  const members = await db.select({ id: users.id, name: users.name, email: users.email }).from(workspaceMembers).innerJoin(users, eq(workspaceMembers.userId, users.id)).where(eq(workspaceMembers.workspaceId, wid));
  const nameOf = (id: string) => { const m = members.find((x) => x.id === id); return m?.name || m?.email || "Member"; };
  const net = computeBalances(me.id, rows.map((r) => ({ creditorId: r.creditorId, debtorId: r.debtorId, amount: Number(r.amount) })));
  return {
    meId: me.id,
    otherMembers: members.filter((m) => m.id !== me.id).map((m) => ({ id: m.id, name: m.name || m.email })),
    balances: [...net.entries()].filter(([, v]) => Math.abs(v) > 0.005).map(([uid, v]) => ({ userId: uid, name: nameOf(uid), net: v })),
    splits: rows.map((r) => ({ id: r.id, note: r.note, creditorId: r.creditorId, debtorId: r.debtorId, amount: Number(r.amount) })),
  };
}

export async function getGoals(): Promise<GoalDTO[]> {
  const wid = await getActiveWorkspaceId();
  if (!wid) return [];
  const db = await getDb();
  const rows = await db.select().from(goals).where(eq(goals.workspaceId, wid)).orderBy(asc(goals.createdAt));
  return rows.map((g) => ({ id: g.id, name: g.name, targetAmount: Number(g.targetAmount), savedAmount: Number(g.savedAmount), deadline: g.deadline, color: g.color }));
}

async function tagsByTransaction(db: Awaited<ReturnType<typeof getDb>>, txIds: string[]): Promise<Map<string, TagRef[]>> {
  const map = new Map<string, TagRef[]>();
  if (!txIds.length) return map;
  const rows = await db
    .select({ txId: transactionTags.transactionId, id: tags.id, name: tags.name, color: tags.color })
    .from(transactionTags)
    .innerJoin(tags, eq(transactionTags.tagId, tags.id))
    .where(inArray(transactionTags.transactionId, txIds));
  for (const r of rows) {
    const arr = map.get(r.txId) ?? [];
    arr.push({ id: r.id, name: r.name, color: r.color });
    map.set(r.txId, arr);
  }
  return map;
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
  const tagMap = await tagsByTransaction(db, rows.map((t) => t.id));
  return rows.map((t) => ({
    id: t.id, type: t.type, amount: Number(t.amount), date: t.date, note: t.note,
    accountId: t.accountId, categoryId: t.categoryId,
    account: t.account ? { name: t.account.name, icon: t.account.icon, color: t.account.color } : null,
    category: t.category ? { name: t.category.name, icon: t.category.icon, color: t.category.color } : null,
    createdByName: t.creator ? (t.creator.name || t.creator.email) : null,
    tags: tagMap.get(t.id) ?? [],
  }));
}

export async function getTags(): Promise<TagDTO[]> {
  const wid = await getActiveWorkspaceId();
  if (!wid) return [];
  const db = await getDb();
  const rows = await db
    .select({ id: tags.id, name: tags.name, color: tags.color, count: sql<number>`count(${transactionTags.transactionId})` })
    .from(tags)
    .leftJoin(transactionTags, eq(transactionTags.tagId, tags.id))
    .where(eq(tags.workspaceId, wid))
    .groupBy(tags.id)
    .orderBy(asc(tags.name));
  return rows.map((r) => ({ id: r.id, name: r.name, color: r.color, count: Number(r.count) }));
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
  if (!rows.length) return [];

  // Walk every calendar month from the first with activity through to the
  // current one. Grouping alone only yields months that *have* transactions, so
  // a quiet month used to vanish — compressing the axis and making the line
  // misreport its own slope.
  const deltas = new Map(rows.map((r) => [r.ym, Number(r.delta)]));
  const lastActive = rows[rows.length - 1].ym;
  const thisMonth = format(startOfMonth(new Date()), "yyyy-MM");
  const stop = parseISO(`${lastActive > thisMonth ? lastActive : thisMonth}-01`);

  const out: NetWorthPoint[] = [];
  let cursor = parseISO(`${rows[0].ym}-01`);
  let running = base;
  for (let guard = 0; cursor <= stop && guard < 1200; guard++) {
    const key = format(cursor, "yyyy-MM");
    running += deltas.get(key) ?? 0;
    out.push({ key, value: running });
    cursor = addMonths(cursor, 1);
  }
  return out;
}
