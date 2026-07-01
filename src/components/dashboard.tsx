"use client";

import { useState } from "react";
import {
  ArrowRightLeft,
  ChevronRight,
  Download,
  Handshake,
  House,
  Menu,
  Minus,
  Moon,
  Plus,
  Receipt,
  Repeat,
  Settings,
  Sun,
  Tags,
  Target,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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

/** Full-width row for the mobile "More" sheet. Returns a raw <button> so Base
    UI's <SheetTrigger render={...}> can clone it and wire up the open handler. */
/** One tab in the always-visible bottom bar: an icon over a label, with a soft
    emerald pill behind the active section. */
function tabItem(active: boolean, Icon: LucideIcon, label: string, onClick: () => void) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className="flex flex-1 flex-col items-center justify-center transition-transform active:scale-95"
    >
      <span
        className={cn(
          "flex flex-col items-center gap-1 rounded-2xl px-3 py-1.5 transition-colors",
          active ? "bg-brand/15 text-brand" : "text-muted-foreground",
        )}
      >
        <Icon className="size-[1.4rem]" strokeWidth={active ? 2.3 : 2} />
        <span className="text-[10.5px] font-medium">{label}</span>
      </span>
    </button>
  );
}

/** One row in the "More" sheet: a tinted icon square, a label, and a chevron. */
function moreRow(Icon: LucideIcon, label: string, tint: string) {
  return (
    <button type="button" className="press flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-accent">
      <span className="grid size-9 shrink-0 place-items-center rounded-[10px] text-white" style={{ backgroundColor: tint }}>
        <Icon className="size-[18px]" />
      </span>
      <span className="flex-1 text-[15px] font-medium">{label}</span>
      <ChevronRight className="size-4 text-muted-foreground" />
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
  const [moreOpen, setMoreOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const showAuthors = members.length > 1;
  const liveAccounts = accounts.filter((a) => !a.archived);

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
      {/* ── App bar: a clean full-width sticky bar on mobile, inline on desktop ── */}
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 pt-safe backdrop-blur-md sm:static sm:z-auto sm:border-0 sm:bg-transparent sm:backdrop-blur-none">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2.5 px-3 py-2.5 sm:gap-3 sm:px-6 sm:pt-6 sm:pb-0">
          <div className="flex min-w-0 items-center gap-2.5 sm:mr-auto">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand text-brand-foreground shadow-sm shadow-brand/25">
              <Wallet className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">Expense Tracker</h1>
              <p className="hidden text-xs text-muted-foreground sm:block">Your money, clearly accounted for.</p>
            </div>
            {workspaces.length > 1 && (
              <WorkspaceSwitcher workspaces={workspaces} activeId={activeWorkspaceId} currentUserId={currentUserId} />
            )}
            {!canEdit && (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">View only</span>
            )}
          </div>

          {/* Desktop action row — on mobile these live in the "More" sheet. */}
          <div className="hidden items-center gap-1.5 sm:flex sm:flex-wrap sm:justify-end">
            {canEdit && (
              <CategoryManager
                categories={categories}
                trigger={<Button variant="outline" size="sm" aria-label="Categories"><Tags className="size-4" /><span className="hidden sm:inline">Categories</span></Button>}
              />
            )}
            {canEdit && (
              <RecurringManager
                recurring={recurring}
                accounts={liveAccounts}
                categories={categories}
                trigger={<Button variant="outline" size="sm" aria-label="Subscriptions"><Repeat className="size-4" /><span className="hidden sm:inline">Subscriptions</span></Button>}
              />
            )}
            <GoalsManager goals={goals} trigger={<Button variant="outline" size="sm" aria-label="Goals"><Target className="size-4" /><span className="hidden sm:inline">Goals</span></Button>} />
            <SplitManager data={split} trigger={<Button variant="outline" size="sm" aria-label="Shared expenses"><Handshake className="size-4" /><span className="hidden sm:inline">Split</span></Button>} />
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
              <div className="flex items-center gap-1">
                <TransactionDialog
                  accounts={liveAccounts} categories={categories} defaultType="income"
                  trigger={<Button size="sm" variant="outline" className="text-positive hover:bg-positive/10 hover:text-positive"><Plus className="size-4" /> Income</Button>}
                />
                <TransactionDialog
                  accounts={liveAccounts} categories={categories} defaultType="expense"
                  trigger={<Button size="sm" variant="outline" className="text-negative hover:bg-negative/10 hover:text-negative"><Minus className="size-4" /> Expense</Button>}
                />
                <TransactionDialog
                  accounts={liveAccounts} categories={categories} defaultType="transfer"
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
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-4 px-3 pt-4 pb-28 sm:space-y-5 sm:px-6 sm:pt-5 sm:pb-6">
        {!emailVerified && <VerifyBanner email={userEmail} />}

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
      </div>

      {/* ── Mobile nav: a clean, always-visible labeled tab bar — one tap to any
          section. "More" opens a sheet with the secondary tools. Mobile only; the
          desktop action row + tab list above cover navigation on larger screens. ── */}
      <div className="fixed inset-x-0 bottom-0 z-40 sm:hidden">
        <nav
          className="flex items-stretch justify-around border-t border-border bg-background/90 px-1 pt-1.5 backdrop-blur-lg"
          style={{ paddingBottom: "max(0.4rem, env(safe-area-inset-bottom))" }}
        >
          {tabItem(tab === "overview", House, "Home", () => changeTab("overview"))}
          {tabItem(tab === "transactions", Receipt, "Activity", () => changeTab("transactions"))}
          {canEdit ? (
            <TransactionDialog
              accounts={liveAccounts}
              categories={categories}
              defaultType="expense"
              trigger={
                <button
                  type="button"
                  aria-label="Add transaction"
                  className="flex flex-1 flex-col items-center justify-center transition-transform active:scale-95"
                >
                  <span className="flex flex-col items-center gap-1 rounded-2xl px-3 py-1.5 text-muted-foreground">
                    <Plus className="size-[1.4rem]" />
                    <span className="text-[10.5px] font-medium">Add</span>
                  </span>
                </button>
              }
            />
          ) : (
            <span className="flex-1" />
          )}
          {tabItem(tab === "analytics", TrendingUp, "Insights", () => changeTab("analytics"))}
          {tabItem(false, Menu, "More", () => setMoreOpen(true))}
        </nav>
      </div>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl sm:hidden" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <SheetHeader className="pb-1">
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="grid gap-0.5 px-2 pb-2">
            {canEdit && <CategoryManager categories={categories} trigger={moreRow(Tags, "Categories", "#0b6e99")} />}
            {canEdit && (
              <RecurringManager recurring={recurring} accounts={liveAccounts} categories={categories} trigger={moreRow(Repeat, "Subscriptions & bills", "#6940a5")} />
            )}
            <GoalsManager goals={goals} trigger={moreRow(Target, "Savings goals", "#0f7b6c")} />
            <SplitManager data={split} trigger={moreRow(Handshake, "Split expenses", "#dd6b20")} />
            <MembersManager members={members} invites={invites} currentEmail={userEmail} workspaceName={workspaceName} isOwner={isOwner} trigger={moreRow(Users, "Sharing", "#d53f8c")} />
            <SettingsDialog currencyCode={currencyCode} userEmail={userEmail} trigger={moreRow(Settings, "Settings", "#787774")} />
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                window.location.assign("/api/export");
              }}
              className="press flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-accent"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[#0f7b6c] text-white"><Download className="size-[18px]" /></span>
              <span className="flex-1 text-[15px] font-medium">Export to Excel</span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </button>
            <button
              type="button"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="press flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-accent"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-foreground/80 text-background">
                {resolvedTheme === "dark" ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
              </span>
              <span className="flex-1 text-[15px] font-medium">{resolvedTheme === "dark" ? "Light mode" : "Dark mode"}</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </SettingsProvider>
  );
}
