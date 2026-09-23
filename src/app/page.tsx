import { Suspense } from "react";
import { after } from "next/server";
import { Dashboard } from "@/components/dashboard";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { getAnalytics } from "@/lib/analytics";
import { getRange, RANGE_TYPES, shiftAnchor, todayISO, type RangeType } from "@/lib/dates";
import {
  getAccountsWithBalances, getBudgetProgress, getCategories,
  getGoals, getInvites, getMembers, getNetWorthSeries, getRangeTotals, getRecurring, getSettings, getSplitData,
  getTransactionsInRange, getTransfersInRange, flushNotices, processRecurring,
} from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { getActiveWorkspace, getUserWorkspaces } from "@/lib/workspace";
import { Landing } from "@/components/landing";

// DB-backed dashboard: always render with fresh data (Cache Components is off).
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; date?: string; tab?: string }>;
}) {
  // Resolve who's asking before anything heavy. This one query decides which of
  // two very different pages we're building, so it must come before any
  // Suspense boundary — otherwise a logged-out visitor gets a flash of the
  // dashboard skeleton in front of the marketing page.
  const user = await getCurrentUser();
  if (!user) return <Landing />;

  const sp = await searchParams;
  const rangeType = (RANGE_TYPES.includes(sp.range as RangeType) ? sp.range : "month") as RangeType;
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : todayISO();
  const initialTab = sp.tab === "transactions" || sp.tab === "analytics" || sp.tab === "accounts" || sp.tab === "planning" ? sp.tab : "overview";

  return (
    // Keyed on the period so moving between months re-suspends and shows the
    // skeleton, rather than leaving stale figures on screen while new ones load.
    <Suspense key={`${rangeType}:${anchor}`} fallback={<DashboardSkeleton />}>
      <DashboardData rangeType={rangeType} anchor={anchor} initialTab={initialTab} />
    </Suspense>
  );
}

/** The expensive half: ~15 queries plus the recurring materialisation. Streams
 *  in behind the skeleton so the shell paints immediately. */
async function DashboardData({
  rangeType,
  anchor,
  initialTab,
}: {
  rangeType: RangeType;
  anchor: string;
  initialTab: "overview" | "transactions" | "analytics" | "accounts" | "planning";
}) {
  // getSession is wrapped in React cache(), so this reuses the lookup the page
  // already made rather than issuing a second query.
  const user = await getCurrentUser();
  if (!user) return <Landing />;

  const range = getRange(rangeType, anchor);
  const prevRange = rangeType === "all" ? null : getRange(rangeType, shiftAnchor(rangeType, anchor, -1));

  // Materialise any due recurring rules before reading data, so a charge that
  // posts today shows up in this render. The resulting emails and web-push
  // sends are network I/O with nothing to contribute to the page, so they run
  // after the response instead of in front of it.
  // Metadata does not depend on posted payments. Start it alongside recurring
  // processing instead of adding another database round trip to every load.
  const [notices, workspaces, activeWorkspace, categories, settings, goals, split, members, invites] = await Promise.all([
    processRecurring(), getUserWorkspaces(), getActiveWorkspace(), getCategories(),
    getSettings(), getGoals(), getSplitData(), getMembers(), getInvites(),
  ]);
  if (notices.length) after(() => flushNotices(notices));

  const [accounts, transactions, transfers, budgetProgress, netWorth, recurring, prevTotals, analytics] = await Promise.all([
    getAccountsWithBalances(),
    getTransactionsInRange(range.start, range.end),
    getTransfersInRange(range.start, range.end),
    getBudgetProgress(),
    getNetWorthSeries(),
    getRecurring(),
    prevRange ? getRangeTotals(prevRange.start, prevRange.end) : Promise.resolve(null),
    // Deeper Insights aggregates. The tab switcher is client-side (no server
    // round-trip), so this has to load with the rest — hence every query in
    // here returns grouped rows rather than raw transactions.
    getAnalytics({ start: range.start, end: range.end }, prevRange),
  ]);

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const comparison = prevTotals ? { prevIncome: prevTotals.income, prevExpense: prevTotals.expense } : null;

  return (
    <Dashboard
      accounts={accounts}
      categories={categories}
      transactions={transactions}
      transfers={transfers}
      rangeType={rangeType}
      anchor={anchor}
      rangeLabel={range.label}
      rangeStart={range.start}
      rangeEnd={range.end}
      totalBalance={totalBalance}
      currency={settings.currency}
      locale={settings.locale}
      currencyCode={settings.currencyCode}
      budgetProgress={budgetProgress}
      netWorth={netWorth}
      comparison={comparison}
      analytics={analytics}
      recurring={recurring}
      goals={goals}
      split={split}
      members={members}
      invites={invites}
      userEmail={user.email}
      workspaces={workspaces}
      activeWorkspaceId={activeWorkspace?.id ?? ""}
      workspaceName={activeWorkspace?.name ?? "Tracker"}
      isOwner={activeWorkspace?.ownerId === user.id}
      currentUserId={user.id}
      emailVerified={!!user.emailVerifiedAt}
      canEdit={activeWorkspace?.role !== "viewer"}
      initialTab={initialTab}
    />
  );
}
