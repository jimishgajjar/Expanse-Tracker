"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  CalendarDays,
  Download,
  Handshake,
  House,
  LogOut,
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
import { logout } from "@/lib/auth";
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
import { SettingsTab } from "@/components/settings-tab";
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
type Tab = "overview" | "transactions" | "analytics" | "accounts" | "planning" | "settings";
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
    description: "Your balances, recent activity, and what comes next.",
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
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    description: "Manage preferences, currency, data portability, and account security.",
  },
];
function toolButton(Icon: LucideIcon, label: string) {
  return (
    <button type="button" className="nav-item group">
      <Icon className="size-[18px] shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
      <span className="truncate">{label}</span>
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
      {pages
        .filter((item) => item.id !== "settings")
        .map((item) => (
          <button
          key={item.id}
          type="button"
          onClick={() => changeTab(item.id)}
          aria-current={tab === item.id ? "page" : undefined}
          className={cn(
            "nav-item relative group",
            tab === item.id && "nav-item-active font-semibold",
          )}
        >
          <item.icon className="size-[18px] shrink-0" />
          <span className="truncate">{item.label}</span>
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
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 min-w-60 max-w-60 shrink-0 flex-col overflow-y-auto border-r border-border bg-sidebar px-3 py-5 lg:flex">
          {/* Brand & Workspace Hub */}
          <div className="mb-4 px-2">
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-lg bg-brand text-brand-foreground shadow-xs">
                <Wallet className="size-4" />
              </span>
              <div className="min-w-0">
                <span className="block text-sm font-semibold tracking-tight text-foreground truncate">
                  Expense Tracker
                </span>
                <span className="block text-[11px] text-muted-foreground truncate">
                  {workspaceName}
                </span>
              </div>
            </div>

            {/* Quick Action Button right in sidebar */}
            {canEdit && (
              <div className="mt-3.5">
                <TransactionDialog
                  accounts={liveAccounts}
                  categories={categories}
                  trigger={
                    <button
                      type="button"
                      className="group flex w-full items-center justify-between rounded-lg border border-border/80 bg-card hover:bg-muted/60 px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors cursor-pointer shadow-2xs"
                    >
                      <span className="flex items-center gap-2">
                        <Plus className="size-3.5 text-brand" />
                        <span>New transaction</span>
                      </span>
                    </button>
                  }
                />
              </div>
            )}
          </div>

          <div>
            <p className="px-3 pb-2 text-[11px] font-medium text-muted-foreground">
              Workspace
            </p>
            {navigation}
          </div>

          <div className="mt-5 border-t border-border/50 pt-3.5">
            <p className="px-3 pb-2 text-[11px] font-medium text-muted-foreground">
              Manage
            </p>
            <div className="grid gap-1">{tools}</div>
          </div>

          <div className="mt-auto shrink-0 space-y-1.5 border-t border-border/50 pt-3.5">
            <button
              type="button"
              onClick={() => changeTab("settings")}
              aria-current={tab === "settings" ? "page" : undefined}
              className={cn(
                "nav-item group w-full text-left cursor-pointer",
                tab === "settings" && "nav-item-active font-semibold",
              )}
            >
              <Settings className={cn("size-[18px] transition-colors", tab === "settings" ? "text-brand" : "text-muted-foreground group-hover:text-foreground")} />
              <span>Settings</span>
              {tab === "settings" && (
                <span className="ml-auto size-1.5 rounded-full bg-brand" />
              )}
            </button>
            <a href="/api/export" className="nav-item group">
              <Download className="size-[18px] text-muted-foreground group-hover:text-foreground transition-colors" />
              <span>Export data</span>
            </a>
            <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-card/60 p-2 shadow-2xs">
              <button
                type="button"
                onClick={() => changeTab("settings")}
                className="flex min-w-0 flex-1 items-center gap-2 text-left hover:opacity-85 transition-opacity cursor-pointer"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-muted text-xs font-semibold text-foreground">
                  {userEmail[0]?.toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <span
                    className="block truncate text-xs font-medium text-foreground"
                    title={userEmail}
                  >
                    {userEmail}
                  </span>
                  <span className="block text-[10px] text-muted-foreground">
                    Preferences
                  </span>
                </div>
              </button>
              <form action={logout}>
                <button
                  type="submit"
                  title="Log out"
                  aria-label="Log out"
                  className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-negative/10 hover:text-negative transition-colors cursor-pointer"
                >
                  <LogOut className="size-3.5" />
                </button>
              </form>
            </div>
          </div>
        </aside>
        <div className="min-w-0 lg:pl-60">
          <header className="border-b border-border bg-card pt-safe">
            <div className="mx-auto flex h-12 max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6 xl:px-8">
              <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
                <Wallet className="size-4 shrink-0 text-brand lg:hidden" />
                <span className="truncate text-sm font-semibold text-foreground">
                  {workspaceName}
                </span>
                <span className="text-muted-foreground/40 font-normal">/</span>
                <span className="truncate text-xs font-medium text-muted-foreground">
                  {page.label}
                </span>
                {workspaces.length > 1 && (
                  <WorkspaceSwitcher
                    workspaces={workspaces}
                    activeId={activeWorkspaceId}
                    currentUserId={currentUserId}
                  />
                )}
                {!canEdit && (
                  <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    View only
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                <ThemeToggle />
                <button
                  type="button"
                  className="grid size-9 place-items-center rounded-lg hover:bg-muted lg:hidden"
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
            className="mx-auto max-w-[1440px] space-y-5 px-4 pt-5 pb-28 sm:px-6 sm:pt-6 lg:pb-8 xl:px-8"
          >
            {!emailVerified && <VerifyBanner email={userEmail} />}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-[-0.035em] text-foreground">
                  {page.label}
                </h1>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {page.description}
                </p>
              </div>
              {canEdit && tab !== "settings" && (
                <TransactionDialog
                  accounts={liveAccounts}
                  categories={categories}
                  trigger={
                    <Button className="hidden h-9 rounded-lg px-3.5 sm:inline-flex text-xs font-medium bg-brand text-brand-foreground shadow-none hover:bg-brand/90">
                      <Plus className="size-3.5 mr-1.5" />
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
              {tab === "settings" && (
                <SettingsTab
                  currencyCode={currencyCode}
                  userEmail={userEmail}
                  workspaceName={workspaceName}
                  canEdit={canEdit}
                />
              )}
            </div>
          </main>
        </div>
        <nav
          aria-label="Mobile navigation"
          className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-border/80 bg-background/90 backdrop-blur-lg px-2 pt-1.5 pb-safe lg:hidden shadow-lg"
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
            const isAdd = id === "add";
            const button = (
              <button
                type="button"
                aria-label={isAdd ? "Add transaction" : label}
                aria-current={tab === id ? "page" : undefined}
                onClick={
                  isAdd
                    ? undefined
                    : () => (id === "more" ? setMoreOpen(true) : changeTab(id))
                }
                className={cn(
                  "flex min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[11px] font-medium transition-colors",
                  tab === id ? "text-brand font-semibold" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid place-items-center transition-transform",
                    isAdd
                      ? "size-8 rounded-xl bg-gradient-to-tr from-brand to-emerald-500 text-white shadow-md shadow-brand/25 active:scale-95"
                      : "h-6 w-10 rounded-lg",
                    !isAdd && tab === id && "bg-brand/10 text-brand",
                  )}
                >
                  <Icon className={cn(isAdd ? "size-4" : "size-4.5")} />
                </span>
                <span className="leading-tight">{label}</span>
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
                <button
                  type="button"
                  onClick={() => changeTab("settings")}
                  className={cn(
                    "nav-item w-full text-left",
                    tab === "settings" && "nav-item-active font-semibold",
                  )}
                >
                  <Settings className="size-[18px]" />
                  <span>Settings</span>
                </button>
                <a href="/api/export" className="nav-item">
                  <Download className="size-[18px]" />
                  Export data
                </a>
                <form action={logout}>
                  <button
                    type="submit"
                    className="nav-item text-negative hover:bg-negative/10 w-full font-medium"
                  >
                    <LogOut className="size-[18px]" />
                    <span>Log out</span>
                  </button>
                </form>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </SettingsProvider>
  );
}
