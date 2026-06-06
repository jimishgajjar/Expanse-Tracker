import { Dashboard } from "@/components/dashboard";
import { getRange, RANGE_TYPES, shiftAnchor, todayISO, type RangeType } from "@/lib/dates";
import {
  getAccountsWithBalances, getBudgetProgress, getCategories,
  getGoals, getInvites, getMembers, getNetWorthSeries, getRangeTotals, getRecurring, getSettings, getSplitData,
  getTransactionsInRange, getTransfersInRange, processRecurring,
} from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { getActiveWorkspace, getUserWorkspaces } from "@/lib/workspace";
import { redirect } from "next/navigation";

// DB-backed dashboard: always render with fresh data (Cache Components is off).
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; date?: string; tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [workspaces, activeWorkspace] = await Promise.all([getUserWorkspaces(), getActiveWorkspace()]);

  const sp = await searchParams;
  const rangeType = (RANGE_TYPES.includes(sp.range as RangeType) ? sp.range : "month") as RangeType;
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : todayISO();
  const range = getRange(rangeType, anchor);
  const prevRange = rangeType === "all" ? null : getRange(rangeType, shiftAnchor(rangeType, anchor, -1));

  // Materialise any due recurring rules before reading data.
  await processRecurring();

  const [accounts, categories, transactions, transfers, settings, budgetProgress, netWorth, recurring, goals, split, members, invites, prevTotals] = await Promise.all([
    getAccountsWithBalances(),
    getCategories(),
    getTransactionsInRange(range.start, range.end),
    getTransfersInRange(range.start, range.end),
    getSettings(),
    getBudgetProgress(),
    getNetWorthSeries(),
    getRecurring(),
    getGoals(),
    getSplitData(),
    getMembers(),
    getInvites(),
    prevRange ? getRangeTotals(prevRange.start, prevRange.end) : Promise.resolve(null),
  ]);

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const comparison = prevTotals ? { prevIncome: prevTotals.income, prevExpense: prevTotals.expense } : null;
  const initialTab = sp.tab === "transactions" || sp.tab === "analytics" ? sp.tab : "overview";

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
