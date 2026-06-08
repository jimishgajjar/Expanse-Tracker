"use client";

import { useState } from "react";
import { ArrowRightLeft, Download, Handshake, House, Minus, Plus, Receipt, Repeat, Settings, Tags, Target, TrendingUp, Users, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/theme-toggle";
import { SettingsProvider } from "@/components/settings-provider";
import { SettingsDialog } from "@/components/settings-dialog";
import { CategoryManager } from "@/components/category-manager";
import { RecurringManager } from "@/components/recurring-manager";
import { GoalsManager } from "@/components/goals-manager";
import { SplitManager } from "@/components/split-manager";
import { MembersManager } from "@/components/members-manager";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { VerifyBanner } from "@/components/verify-banner";
import { TransactionDialog } from "@/components/transaction-dialog";
import { PeriodBar } from "@/components/period-bar";
import { OverviewTab } from "@/components/overview-tab";
import { TransactionsTab } from "@/components/transactions-tab";
import { AnalyticsTab, type Comparison } from "@/components/analytics-tab";
import type { RangeType } from "@/lib/dates";
import type { AccountDTO, BudgetProgressDTO, CategoryDTO, GoalDTO, MemberDTO, NetWorthPoint, RecurringDTO, SplitData, TransactionDTO, TransferDTO } from "@/lib/queries";
import type { WorkspaceSummary } from "@/lib/workspace";

type Tab = "overview" | "transactions" | "analytics";

export function Dashboard({
  accounts,
  categories,
  transactions,
  transfers,
  rangeType,
  anchor,
  rangeLabel,
  rangeStart,
  rangeEnd,
  totalBalance,
  currency,
  locale,
  currencyCode,
  budgetProgress,
  netWorth,
  comparison,
  recurring,
  goals,
  split,
  members,
  invites,
  userEmail,
  workspaces,
  activeWorkspaceId,
  workspaceName,
  isOwner,
  currentUserId,
  emailVerified,
  canEdit,
  initialTab,
}: {
  accounts: AccountDTO[];
  categories: CategoryDTO[];
  transactions: TransactionDTO[];
  transfers: TransferDTO[];
  rangeType: RangeType;
  anchor: string;
  rangeLabel: string;
  rangeStart: string;
  rangeEnd: string;
  totalBalance: number;
  currency: string;
  locale: string;
  currencyCode: string;
  budgetProgress: BudgetProgressDTO[];
  netWorth: NetWorthPoint[];
  comparison: Comparison;
  recurring: RecurringDTO[];
  goals: GoalDTO[];
  split: SplitData;
  members: MemberDTO[];
  invites: string[];
  userEmail: string;
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string;
  workspaceName: string;
  isOwner: boolean;
  currentUserId: string;
  emailVerified: boolean;
  canEdit: boolean;
  initialTab: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const showAuthors = members.length > 1;

  // Persist the active tab in the URL without a server round-trip.
  function changeTab(t: Tab) {
    setTab(t);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (t === "overview") url.searchParams.delete("tab");
      else url.searchParams.set("tab", t);
      window.history.replaceState(null, "", url);
    }
  }

  return (
    <SettingsProvider currency={currency} locale={locale}>
      <div className="mx-auto max-w-6xl space-y-4 px-3 py-5 pb-24 sm:space-y-5 sm:px-6 sm:py-6 sm:pb-6">
        {!emailVerified && <VerifyBanner email={userEmail} />}
        <header className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <div className="flex items-center gap-2.5 sm:mr-auto">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand text-brand-foreground shadow-sm shadow-brand/25">
              <Wallet className="size-5" />
            </span>
            <div>
              <h1 className="text-lg font-semibold tracking-tight sm:text-xl">Expense Tracker</h1>
              <p className="hidden text-xs text-muted-foreground sm:block">Your money, clearly accounted for.</p>
            </div>
            {workspaces.length > 1 && (
              <WorkspaceSwitcher workspaces={workspaces} activeId={activeWorkspaceId} currentUserId={currentUserId} />
            )}
            {!canEdit && (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">View only</span>
            )}
          </div>
          <div className="flex items-center gap-1 max-sm:w-full max-sm:justify-between max-sm:[&_button]:size-9 max-sm:[&_button]:!px-0 max-sm:[&_button]:!border-transparent max-sm:[&_button]:!bg-transparent max-sm:[&_button]:!shadow-none sm:flex-wrap sm:gap-2">
          {canEdit && (
            <CategoryManager
              categories={categories}
              trigger={<Button variant="outline" size="sm" aria-label="Categories"><Tags className="size-4" /><span className="hidden sm:inline">Categories</span></Button>}
            />
          )}
          {canEdit && (
            <RecurringManager
              recurring={recurring}
              accounts={accounts.filter((a) => !a.archived)}
              categories={categories}
              trigger={<Button variant="outline" size="sm" aria-label="Subscriptions"><Repeat className="size-4" /><span className="hidden sm:inline">Subscriptions</span></Button>}
            />
          )}
          <GoalsManager
            goals={goals}
            trigger={<Button variant="outline" size="sm" aria-label="Goals"><Target className="size-4" /><span className="hidden sm:inline">Goals</span></Button>}
          />
          <SplitManager
            data={split}
            trigger={<Button variant="outline" size="sm" aria-label="Shared expenses"><Handshake className="size-4" /><span className="hidden sm:inline">Split</span></Button>}
          />
          <MembersManager
            members={members}
            invites={invites}
            currentEmail={userEmail}
            workspaceName={workspaceName}
            isOwner={isOwner}
            trigger={<Button variant="outline" size="sm" aria-label="Sharing"><Users className="size-4" /><span className="hidden sm:inline">Sharing</span></Button>}
          />
          <Button variant="outline" size="sm" aria-label="Export to Excel" onClick={() => window.location.assign("/api/export")}>
            <Download className="size-4" /><span className="hidden sm:inline">Export</span>
          </Button>
          {canEdit && (
            <div className="hidden items-center gap-1 sm:flex">
              <TransactionDialog
                accounts={accounts.filter((a) => !a.archived)} categories={categories} defaultType="income"
                trigger={<Button size="sm" variant="outline" className="text-positive hover:bg-positive/10 hover:text-positive"><Plus className="size-4" /> Income</Button>}
              />
              <TransactionDialog
                accounts={accounts.filter((a) => !a.archived)} categories={categories} defaultType="expense"
                trigger={<Button size="sm" variant="outline" className="text-negative hover:bg-negative/10 hover:text-negative"><Minus className="size-4" /> Expense</Button>}
              />
              <TransactionDialog
                accounts={accounts.filter((a) => !a.archived)} categories={categories} defaultType="transfer"
                trigger={<Button size="sm" variant="outline"><ArrowRightLeft className="size-4" /> Transfer</Button>}
              />
            </div>
          )}
          <SettingsDialog
            currencyCode={currencyCode}
            userEmail={userEmail}
            trigger={<Button variant="ghost" size="icon" aria-label="Settings"><Settings className="size-4" /></Button>}
          />
          <ThemeToggle />
          </div>
        </header>

        <PeriodBar rangeType={rangeType} anchor={anchor} rangeLabel={rangeLabel} />

        <Tabs value={tab} onValueChange={(v) => changeTab(v as Tab)}>
          <TabsList className="hidden w-full sm:inline-flex sm:w-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === "overview" && (
          <OverviewTab
            accounts={accounts}
            transactions={transactions}
            transfers={transfers}
            categories={categories}
            totalBalance={totalBalance}
            rangeLabel={rangeLabel}
            rangeType={rangeType}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            comparison={comparison}
            canEdit={canEdit}
          />
        )}
        {tab === "transactions" && (
          <TransactionsTab transactions={transactions} transfers={transfers} accounts={accounts} categories={categories} canEdit={canEdit} showAuthors={showAuthors} />
        )}
        {tab === "analytics" && (
          <AnalyticsTab
            transactions={transactions}
            rangeType={rangeType}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            budgets={budgetProgress}
            categories={categories}
            netWorth={netWorth}
            comparison={comparison}
          />
        )}

        {/* ── Mobile app chrome: floating + button and a bottom tab bar ── */}
        {canEdit && (
          <div className="fixed right-4 bottom-20 z-40 sm:hidden" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
            <TransactionDialog
              accounts={accounts.filter((a) => !a.archived)} categories={categories} defaultType="expense"
              trigger={<Button size="icon" aria-label="Add transaction" className="size-14 rounded-full shadow-lg shadow-brand/30"><Plus className="size-6" /></Button>}
            />
          </div>
        )}
        <nav
          className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t bg-background/90 backdrop-blur-md sm:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {([
            { id: "overview", label: "Home", Icon: House },
            { id: "transactions", label: "Activity", Icon: Receipt },
            { id: "analytics", label: "Insights", Icon: TrendingUp },
          ] as const).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => changeTab(id)}
              aria-current={tab === id ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors",
                tab === id ? "text-brand" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" strokeWidth={tab === id ? 2.4 : 2} />
              {label}
            </button>
          ))}
        </nav>
      </div>
    </SettingsProvider>
  );
}
