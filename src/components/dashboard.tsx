"use client";

import { useState } from "react";
import {
  ArrowRightLeft,
  Download,
  Handshake,
  House,
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
/** One tile in the Control-Center launcher grid: a rounded icon square + label.
    Used directly for tab/action tiles and as the `trigger` for manager dialogs. */
function launchTile(
  Icon: LucideIcon,
  label: string,
  tint: string,
  opts: { active?: boolean; primary?: boolean; onClick?: () => void } = {},
) {
  return (
    <button
      type="button"
      onClick={opts.onClick}
      aria-label={label}
      className={cn(
        "press flex flex-col items-center gap-2 rounded-2xl p-2.5 transition-colors",
        opts.active ? "bg-white/10 ring-1 ring-brand/60" : "hover:bg-white/5",
      )}
    >
      <span
        className={cn(
          "grid size-[3.25rem] place-items-center rounded-[1.1rem] text-white",
          opts.primary ? "shadow-[0_6px_18px_rgba(16,185,129,0.5)]" : "shadow-sm",
        )}
        style={{ backgroundColor: tint }}
      >
        <Icon className="size-6" />
      </span>
      <span className="text-center text-[11.5px] leading-tight font-medium text-white/85">{label}</span>
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
  const [launcherOpen, setLauncherOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const showAuthors = members.length > 1;
  const liveAccounts = accounts.filter((a) => !a.archived);
  // The launcher grabber reflects the section you're currently viewing.
  const current =
    tab === "transactions"
      ? { Icon: Receipt, label: "Activity" }
      : tab === "analytics"
        ? { Icon: TrendingUp, label: "Insights" }
        : { Icon: House, label: "Overview" };
  const CurrentIcon = current.Icon;

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

      {/* ── Mobile nav: a "Control Center" launcher. A frosted grabber sits at the
          bottom; tapping it raises a grid of every destination. Mobile only — the
          desktop action row + tab list above cover navigation on larger screens. ── */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 flex justify-center sm:hidden"
        style={{ paddingBottom: "max(0.55rem, env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          onClick={() => setLauncherOpen(true)}
          aria-label="Open navigation"
          aria-haspopup="dialog"
          className="press flex items-center gap-2.5 rounded-full border border-white/15 bg-black/45 py-2.5 pr-3 pl-4 text-white shadow-[0_10px_30px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.16)] backdrop-blur-2xl backdrop-saturate-150"
        >
          <CurrentIcon className="size-[1.15rem]" />
          <span className="text-[13px] font-semibold whitespace-nowrap">{current.label}</span>
          <span className="ml-0.5 grid grid-cols-2 gap-[3px]" aria-hidden>
            <i className="size-[5px] rounded-[1.5px] bg-white/75" />
            <i className="size-[5px] rounded-[1.5px] bg-white/75" />
            <i className="size-[5px] rounded-[1.5px] bg-white/75" />
            <i className="size-[5px] rounded-[1.5px] bg-white/75" />
          </span>
        </button>
      </div>

      <Sheet open={launcherOpen} onOpenChange={setLauncherOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl border-t border-white/10 bg-neutral-900/85 text-white backdrop-blur-xl sm:hidden"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <SheetHeader className="pb-2">
            <SheetTitle className="text-center text-[13px] font-medium text-white/55">{workspaceName}</SheetTitle>
          </SheetHeader>
          <div className="grid max-h-[70dvh] grid-cols-3 gap-1.5 overflow-y-auto px-1.5 pb-2">
            {launchTile(House, "Overview", "#0f7b6c", {
              active: tab === "overview",
              onClick: () => {
                changeTab("overview");
                setLauncherOpen(false);
              },
            })}
            {launchTile(Receipt, "Activity", "#0b6e99", {
              active: tab === "transactions",
              onClick: () => {
                changeTab("transactions");
                setLauncherOpen(false);
              },
            })}
            {launchTile(TrendingUp, "Insights", "#6940a5", {
              active: tab === "analytics",
              onClick: () => {
                changeTab("analytics");
                setLauncherOpen(false);
              },
            })}
            {canEdit && (
              <TransactionDialog
                accounts={liveAccounts}
                categories={categories}
                defaultType="expense"
                trigger={launchTile(Plus, "Add", "#047857", { primary: true })}
              />
            )}
            {canEdit && <CategoryManager categories={categories} trigger={launchTile(Tags, "Categories", "#0b6e99")} />}
            {canEdit && (
              <RecurringManager recurring={recurring} accounts={liveAccounts} categories={categories} trigger={launchTile(Repeat, "Subscriptions", "#6940a5")} />
            )}
            <GoalsManager goals={goals} trigger={launchTile(Target, "Goals", "#0f7b6c")} />
            <SplitManager data={split} trigger={launchTile(Handshake, "Split", "#dd6b20")} />
            <MembersManager members={members} invites={invites} currentEmail={userEmail} workspaceName={workspaceName} isOwner={isOwner} trigger={launchTile(Users, "Sharing", "#d53f8c")} />
            <SettingsDialog currencyCode={currencyCode} userEmail={userEmail} trigger={launchTile(Settings, "Settings", "#787774")} />
            {launchTile(Download, "Export", "#0b6e99", {
              onClick: () => {
                setLauncherOpen(false);
                window.location.assign("/api/export");
              },
            })}
            {launchTile(resolvedTheme === "dark" ? Sun : Moon, resolvedTheme === "dark" ? "Light" : "Dark", "#3f3f46", {
              onClick: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
            })}
          </div>
        </SheetContent>
      </Sheet>
    </SettingsProvider>
  );
}
