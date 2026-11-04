import { Suspense } from "react";
import { recordedBalance } from "@/lib/mobile-contract";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { commentLink } from "@/lib/comment-link";
import { pilotDatabase,pilotAvailable } from "@/lib/pilot-release";
import { Dashboard } from "@/components/dashboard";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { getOverviewData } from "@/lib/overview-data";
import { getRange, RANGE_TYPES, shiftAnchor, todayISO, type RangeType } from "@/lib/dates";
import {
  getAccountsWithBalances, getBudgetProgress, getCategories,
  getRangeTotals, getRecurring, getSettings,
  flushNotices, processRecurring,
} from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { getActiveWorkspace, getUserWorkspaces } from "@/lib/workspace";
import { canEditSharedLedger, canManageSharing } from "@/lib/household-access";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { logout } from "@/lib/auth";
import { Landing } from "@/components/landing";
import { bankDemoEnabled } from "@/lib/bank-demo/config";
import { sandboxInboxEnabled } from "@/lib/plaid-sandbox/config";
import { householdFeaturesEnabled } from "@/lib/household-features";
import { isPersonalLedger } from "@/lib/household-access";
import { financeDatabase } from "@/lib/finance-release";
import { financeReport } from "@/lib/finance-position";

// DB-backed dashboard: always render with fresh data (Cache Components is off).
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; date?: string; tab?: string; thread?: string; household?: string }>;
}) {
  // Resolve who's asking before anything heavy. This one query decides which of
  // two very different pages we're building, so it must come before any
  // Suspense boundary — otherwise a logged-out visitor gets a flash of the
  // dashboard skeleton in front of the marketing page.
  const user = await getCurrentUser();
  const sp = await searchParams;
  if (!user) {
    const next = householdFeaturesEnabled() && (sp.tab === "settings" ? "/?tab=settings" :
      sp.tab === "transactions" && commentLink(sp.thread,sp.household));
    if (next) redirect("/login?" + new URLSearchParams({next}));
    return <Landing />;
  }
  const rangeType = (RANGE_TYPES.includes(sp.range as RangeType) ? sp.range : "month") as RangeType;
  let anchor = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : todayISO();
  if (!sp.date && pilotAvailable()) {
    const [workspace,db]=await Promise.all([getActiveWorkspace(),pilotDatabase()]);
    if (workspace && db) {
      const {rows:[prefs]}=await db.query<{timezone:string}>("SELECT timezone FROM household_setup WHERE workspace_id=$1 AND EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id=$1 AND user_id=$2)",[workspace.id,user.id]);
      if (prefs) anchor=new Intl.DateTimeFormat("en-CA",{timeZone:prefs.timezone,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
    }
  }
  const initialTab = sp.tab === "transactions" || sp.tab === "analytics" || sp.tab === "accounts" || sp.tab === "planning" || sp.tab === "settings" ? sp.tab : "overview";

  return (
    // Keyed on the period so moving between months re-suspends and shows the
    // skeleton, rather than leaving stale figures on screen while new ones load.
    <Suspense key={`${rangeType}:${anchor}`} fallback={<DashboardSkeleton />}>
      <DashboardData rangeType={rangeType} anchor={anchor} initialTab={initialTab} />
    </Suspense>
  );
}

/** Overview data streams behind the shell. Detailed reports and workspace tools load on demand. */
async function DashboardData({
  rangeType,
  anchor,
  initialTab,
}: {
  rangeType: RangeType;
  anchor: string;
  initialTab: "overview" | "transactions" | "analytics" | "accounts" | "planning" | "settings";
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
  const [notices, workspaces, activeWorkspace, categories, settings] = await Promise.all([
    processRecurring(), getUserWorkspaces(), getActiveWorkspace(), getCategories(),
    getSettings(),
  ]);
  if (notices.length) after(() => flushNotices(notices));
  if (!activeWorkspace) return <main className="mx-auto max-w-md space-y-4 p-6">
    <h1 className="text-xl font-semibold">Tracker unavailable</h1>
    <p className="text-sm text-muted-foreground">{workspaces.length ? "Choose a tracker you still have access to." : "Ask the tracker owner for access or sign in with another account."}</p>
    {workspaces.length > 0 && <WorkspaceSwitcher workspaces={workspaces} activeId="" currentUserId={user.id}/>}
    <form action={logout}><button className="text-sm underline">Sign out</button></form>
  </main>;

  const [accounts, overview, budgetProgress, recurring, prevTotals, finance] = await Promise.all([
    getAccountsWithBalances(),
    getOverviewData(range.start, range.end, rangeType),
    getBudgetProgress(), getRecurring(),
    prevRange ? getRangeTotals(prevRange.start, prevRange.end) : Promise.resolve(null),
    financeDatabase().then(db=>db ? financeReport(db,{workspace:activeWorkspace.id,actor:user.id}):null),
  ]);

  const totalBalance = recordedBalance(accounts);
  const comparison = prevTotals ? { prevIncome: prevTotals.income, prevExpense: prevTotals.expense } : null;

  return (
    <Dashboard
      key={activeWorkspace?.id ?? "signed-out"}
      accounts={accounts}
      categories={categories}
      transactions={overview.chartTransactions}
      recentTransactions={overview.recent}
      transferCount={overview.transferCount}
      rangeType={rangeType}
      anchor={anchor}
      rangeLabel={range.label}
      rangeStart={range.start}
      rangeEnd={range.end}
      totalBalance={totalBalance}
      currency={settings.currency}
      locale={settings.locale}
      currencyCode={settings.currencyCode}
      finance={finance}
      budgetProgress={budgetProgress}
      comparison={comparison}
      recurring={recurring}
      userEmail={user.email}
      workspaces={workspaces}
      activeWorkspaceId={activeWorkspace?.id ?? ""}
      workspaceName={activeWorkspace?.name ?? "Tracker"}
      isOwner={canManageSharing(activeWorkspace, user.id)}
      currentUserId={user.id}
      emailVerified={!!user.emailVerifiedAt}
      canEdit={canEditSharedLedger(activeWorkspace.role)}
      initialTab={initialTab}
      pilot={pilotAvailable()}
      bankDemoAvailable={bankDemoEnabled()}
      bankInboxAvailable={sandboxInboxEnabled()}
      privateAccountsAvailable={householdFeaturesEnabled() && !isPersonalLedger(activeWorkspace.id)}
    />
  );
}
