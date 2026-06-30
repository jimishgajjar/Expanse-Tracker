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
  // Which dock slot the sliding spotlight sits under (slot 2 is the centre "+").
  const activeSlot = tab === "transactions" ? 1 : tab === "analytics" ? 3 : 0;

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

      {/* ── Mobile app chrome: a full-width "liquid glass" dock + More sheet.
          A single emerald spotlight glides under the active tab; the active icon
          and label light up white, and a glowing brand "+" sits in the centre. ── */}
      <div className="fixed inset-x-0 bottom-0 z-40 sm:hidden">
        <nav
          className="relative flex items-start rounded-t-[1.75rem] border-t border-white/12 bg-black/40 px-2 pt-2.5 shadow-[0_-10px_30px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-2xl backdrop-saturate-150"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.6rem)" }}
        >
          {/* Sliding spotlight — one slot wide, glides under the active tab. */}
          <div
            aria-hidden
            className="pointer-events-none absolute top-2.5 left-2 h-[3.25rem] w-[calc((100%-1rem)/5)] transition-transform duration-500 ease-out-expo"
            style={{ transform: `translateX(calc(${activeSlot} * 100%))` }}
          >
            <div className="size-full rounded-[1.15rem] bg-brand/20 ring-1 ring-white/20 ring-inset shadow-[0_0_22px_rgba(16,185,129,0.28)]" />
          </div>

          {spotTab(tab === "overview", House, "Home", () => changeTab("overview"))}
          {spotTab(tab === "transactions", Receipt, "Activity", () => changeTab("transactions"))}

          <div className="relative z-10 flex h-[3.25rem] flex-1 items-center justify-center">
            {canEdit && (
              <TransactionDialog
                accounts={liveAccounts}
                categories={categories}
                defaultType="expense"
                trigger={
                  <button
                    type="button"
                    aria-label="Add transaction"
                    className="flex size-12 items-center justify-center rounded-2xl bg-brand text-brand-foreground shadow-[0_5px_18px_rgba(16,185,129,0.5)] ring-1 ring-white/15 transition-transform active:scale-90"
                  >
                    <Plus className="size-6" />
                  </button>
                }
              />
            )}
          </div>

          {spotTab(tab === "analytics", TrendingUp, "Insights", () => changeTab("analytics"))}
          {spotTab(false, Menu, "More", () => setMoreOpen(true))}
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
              onClick={() => { setMoreOpen(false); window.location.assign("/api/export"); }}
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

function spotTab(active: boolean, Icon: LucideIcon, label: string, onClick: () => void) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className="relative z-10 flex h-[3.25rem] flex-1 flex-col items-center justify-center gap-1 transition-transform active:scale-90"
    >
      <Icon
        className={cn("size-[1.35rem] transition-all duration-300", active ? "scale-110 text-white" : "text-white/45")}
        strokeWidth={active ? 2.4 : 2}
      />
      <span
        className={cn(
          "text-[10px] leading-none font-semibold transition-opacity duration-300",
          active ? "text-white opacity-100" : "text-white opacity-0",
        )}
      >
        {label}
      </span>
    </button>
  );
}
