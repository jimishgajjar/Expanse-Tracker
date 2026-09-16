"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  CalendarDays,
  Download,
  Handshake,
  House,
  Menu,
  Plus,
  Receipt,
  Repeat,
  Settings,
  Tags,
  Target,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { AccountsSection } from "@/components/accounts-section";
import { PlanningTab } from "@/components/planning-tab";
import type { Comparison } from "@/components/analytics-tab";
import type { AnalyticsData } from "@/lib/analytics";
import type { RangeType } from "@/lib/dates";
import type {
  AccountDTO,
  BudgetProgressDTO,
  CategoryDTO,
  GoalDTO,
  MemberDTO,
  NetWorthPoint,
  RecurringDTO,
  SplitData,
  TransactionDTO,
  TransferDTO,
} from "@/lib/queries";
import type { WorkspaceSummary } from "@/lib/workspace";

const AnalyticsTab = dynamic(
  () => import("@/components/analytics-tab").then((m) => m.AnalyticsTab),
  {
    loading: () => (
      <p className="py-12 text-muted-foreground" role="status">
        Loading insights…
      </p>
    ),
  },
);
const TransactionsTab = dynamic(
  () => import("@/components/transactions-tab").then((m) => m.TransactionsTab),
  {
    loading: () => (
      <p className="py-12 text-muted-foreground" role="status">
        Loading activity…
      </p>
    ),
  },
);
type Tab = "overview" | "transactions" | "analytics" | "accounts" | "planning";
const pages: {
  id: Tab;
  label: string;
  icon: LucideIcon;
  description: string;
}[] = [
  {
    id: "overview",
    label: "Overview",
    icon: House,
    description: "A little clarity for your everyday money.",
  },
  {
    id: "transactions",
    label: "Activity",
    icon: Receipt,
    description: "Every expense, income and transfer, together.",
  },
  {
    id: "accounts",
    label: "Accounts",
    icon: Wallet,
    description: "Your balances, with the full picture behind them.",
  },
  {
    id: "planning",
    label: "Planning",
    icon: CalendarDays,
    description: "Make room for what is coming next.",
  },
  {
    id: "analytics",
    label: "Insights",
    icon: TrendingUp,
    description: "Understand what changed and where your money goes.",
  },
];
function toolButton(Icon: LucideIcon, label: string) {
  return (
    <button type="button" className="nav-item">
      <Icon className="size-[18px] shrink-0" />
      <span>{label}</span>
    </button>
  );
}
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
  analytics,
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
  analytics: AnalyticsData;
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
  const [moreOpen, setMoreOpen] = useState(false);
  const showAuthors = members.length > 1;
  const liveAccounts = accounts.filter((a) => !a.archived);
  const page = pages.find((p) => p.id === tab)!;

  function changeTab(value: Tab) {
    setTab(value);
    setMoreOpen(false);
    const url = new URL(window.location.href);
    if (value === "overview") url.searchParams.delete("tab");
    else url.searchParams.set("tab", value);
    window.history.replaceState(null, "", url);
  }

  const tools = (
    <>
      {canEdit && (
        <CategoryManager
          categories={categories}
          trigger={toolButton(Tags, "Categories")}
        />
      )}
      {canEdit && (
        <RecurringManager
          recurring={recurring}
          accounts={liveAccounts}
          categories={categories}
          trigger={toolButton(Repeat, "Subscriptions & bills")}
        />
      )}
      {canEdit && (
        <GoalsManager
          goals={goals}
          trigger={toolButton(Target, "Savings goals")}
        />
      )}
      {canEdit && (
        <SplitManager
          data={split}
          trigger={toolButton(Handshake, "Shared expenses")}
        />
      )}
      <MembersManager
        members={members}
        invites={invites}
        currentEmail={userEmail}
        workspaceName={workspaceName}
        isOwner={isOwner}
        trigger={toolButton(Users, "Members & sharing")}
      />
    </>
  );
  const navigation = (
    <nav aria-label="Main navigation" className="grid gap-1">
      {pages.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => changeTab(item.id)}
          aria-current={tab === item.id ? "page" : undefined}
          className={cn("nav-item", tab === item.id && "nav-item-active")}
        >
          <item.icon className="size-[18px]" />
          <span>{item.label}</span>
          {tab === item.id && (
            <span className="ml-auto size-1.5 rounded-full bg-brand" />
          )}
        </button>
      ))}
    </nav>
  );

  return (
    <SettingsProvider currency={currency} locale={locale}>
      <div key={activeWorkspaceId} className="app-shell min-h-dvh">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-background focus:p-3"
        >
          Skip to content
        </a>
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-52 flex-col overflow-y-auto border-r bg-sidebar px-3 py-4 lg:flex">
          <div className="mb-6 flex items-center gap-3 px-3">
            <span className="grid size-9 place-items-center rounded-xl bg-brand text-brand-foreground">
              <Wallet className="size-5" />
            </span>
            <span className="text-sm font-semibold tracking-tight">
              Expense Tracker
            </span>
          </div>
          {navigation}
          <div className="mt-5 border-t pt-4">
            <p className="px-3 pb-2 text-xs font-medium text-muted-foreground">
              Your workspace
            </p>
            <div className="grid gap-1">{tools}</div>
          </div>
          <div className="mt-auto shrink-0 space-y-1 border-t pt-4">
            <SettingsDialog
              currencyCode={currencyCode}
              userEmail={userEmail}
              canEdit={canEdit}
              trigger={toolButton(Settings, "Settings")}
            />
            <a href="/api/export" className="nav-item">
              <Download className="size-[18px]" />
              Export data
            </a>
            <div className="mt-4 flex items-center gap-2 px-3 py-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand/10 text-xs font-semibold text-brand">
                {userEmail[0]?.toUpperCase()}
              </span>
              <span
                className="min-w-0 truncate text-xs text-muted-foreground"
                title={userEmail}
              >
                {userEmail}
              </span>
            </div>
          </div>
        </aside>
        <div className="min-w-0 lg:pl-52">
          <header className="border-b bg-background pt-safe">
            <div className="mx-auto flex h-12 max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-5 xl:px-6">
              <div className="flex min-w-0 items-center gap-2.5">
                <Wallet className="size-[18px] shrink-0 text-brand lg:hidden" />
                <span className="truncate text-sm font-medium">
                  {workspaceName}
                </span>
                {workspaces.length > 1 && (
                  <WorkspaceSwitcher
                    workspaces={workspaces}
                    activeId={activeWorkspaceId}
                    currentUserId={currentUserId}
                  />
                )}
                {!canEdit && (
                  <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                    View only
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <ThemeToggle />
                <button
                  type="button"
                  className="grid size-11 place-items-center rounded-lg hover:bg-muted lg:hidden"
                  onClick={() => setMoreOpen(true)}
                  aria-label="Open navigation"
                >
                  <Menu className="size-5" />
                </button>
              </div>
            </div>
          </header>
          <main
            id="main-content"
            className="mx-auto max-w-[1600px] space-y-4 px-4 pt-4 pb-28 sm:px-5 sm:pt-5 lg:pb-8 xl:px-6"
          >
            {!emailVerified && <VerifyBanner email={userEmail} />}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  {page.label}
                </h1>
                <p className="mt-1 text-xs text-muted-foreground">
                  {page.description}
                </p>
              </div>
              {canEdit && (
                <TransactionDialog
                  accounts={liveAccounts}
                  categories={categories}
                  trigger={
                    <Button className="hidden h-11 px-4 sm:inline-flex">
                      <Plus className="size-4" />
                      Add transaction
                    </Button>
                  }
                />
              )}
            </div>
            {(tab === "overview" ||
              tab === "transactions" ||
              tab === "analytics") && (
              <PeriodBar
                rangeType={rangeType}
                anchor={anchor}
                rangeLabel={rangeLabel}
              />
            )}
            <div key={tab} className="surface-enter">
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
                  budgets={budgetProgress}
                  recurring={recurring}
                  onActivity={() => changeTab("transactions")}
                  onPlanning={() => changeTab("planning")}
                />
              )}
              {tab === "transactions" && (
                <TransactionsTab
                  transactions={transactions}
                  transfers={transfers}
                  accounts={accounts}
                  categories={categories}
                  canEdit={canEdit}
                  showAuthors={showAuthors}
                />
              )}
              {tab === "accounts" && (
                <AccountsSection
                  accounts={accounts}
                  categories={categories}
                  canEdit={canEdit}
                />
              )}
              {tab === "planning" && (
                <PlanningTab
                  budgets={budgetProgress}
                  categories={categories}
                  accounts={liveAccounts}
                  recurring={recurring}
                  goals={goals}
                  split={split}
                  canEdit={canEdit}
                />
              )}
              {tab === "analytics" && (
                <AnalyticsTab
                  transactions={transactions}
                  rangeType={rangeType}
                  rangeStart={rangeStart}
                  rangeEnd={rangeEnd}
                  rangeLabel={rangeLabel}
                  budgets={budgetProgress}
                  categories={categories}
                  accounts={liveAccounts}
                  recurring={recurring}
                  netWorth={netWorth}
                  comparison={comparison}
                  analytics={analytics}
                  canEdit={canEdit}
                  showAuthors={showAuthors}
                />
              )}
            </div>
          </main>
        </div>
        <nav
          aria-label="Mobile navigation"
          className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t bg-background px-2 pt-2 pb-safe lg:hidden"
        >
          {(
            [
              ["overview", House, "Home"],
              ["transactions", Receipt, "Activity"],
              ["add", Plus, "Add"],
              ["analytics", TrendingUp, "Insights"],
              ["more", Menu, "More"],
            ] as const
          ).map(([id, Icon, label]) => {
            const button = (
              <button
                type="button"
                aria-label={id === "add" ? "Add transaction" : label}
                aria-current={tab === id ? "page" : undefined}
                onClick={
                  id === "add"
                    ? undefined
                    : () => (id === "more" ? setMoreOpen(true) : changeTab(id))
                }
                className={cn(
                  "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-3 text-xs font-medium",
                  tab === id ? "text-brand" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid h-7 w-11 place-items-center rounded-lg",
                    id === "add"
                      ? "bg-brand text-brand-foreground"
                      : tab === id && "bg-brand/10",
                  )}
                >
                  <Icon className="size-5" />
                </span>
                {label}
              </button>
            );
            return id === "add" ? (
              canEdit ? (
                <TransactionDialog
                  key={id}
                  accounts={liveAccounts}
                  categories={categories}
                  trigger={button}
                />
              ) : (
                <span key={id} className="flex-1" />
              )
            ) : (
              <span key={id} className="flex flex-1">
                {button}
              </span>
            );
          })}
        </nav>
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetContent
            side="left"
            className="w-[min(320px,90vw)] overflow-y-auto lg:hidden"
          >
            <SheetHeader>
              <SheetTitle>Your workspace</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 px-4 pb-8">
              {navigation}
              <div className="grid gap-1 border-t pt-4">
                {tools}
                <SettingsDialog
                  currencyCode={currencyCode}
                  userEmail={userEmail}
                  canEdit={canEdit}
                  trigger={toolButton(Settings, "Settings")}
                />
                <a href="/api/export" className="nav-item">
                  <Download className="size-[18px]" />
                  Export data
                </a>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </SettingsProvider>
  );
}
