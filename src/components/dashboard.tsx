"use client";

import { useSearchParams } from "next/navigation";
import { Conversation } from "./transaction-comments";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { DeferredTools, DeferredPlanning, DeferredAnalytics } from "./deferred-sections";
import { PagedActivity } from "./paged-activity";
import { CommandPalette, CommandSearchTrigger } from "./command-palette";
import {
  CalendarDays,
  Download,
  House,
  LogOut,
  Menu,
  Plus,
  Receipt,
  Repeat,
  Search,
  Settings,
  Tags,
  TrendingUp,
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
import { CommentsAvailable, SettingsProvider } from "@/components/settings-provider";
import { trackerExportHref } from "@/lib/household-access";
import { CategoryManager } from "@/components/category-manager";
import { RecurringManager } from "@/components/recurring-manager";
import { PrivateAccountsButton, WorkspaceSwitcher } from "@/components/workspace-switcher";
import { VerifyBanner } from "@/components/verify-banner";
import { TransactionDialog } from "@/components/transaction-dialog";
import { PeriodBar } from "@/components/period-bar";
import { OverviewTab } from "@/components/overview-tab";
import { PositionSummary } from "./position-summary";
import type { FinanceReport } from "@/lib/finance-position";
import { AccountsSection } from "@/components/accounts-section";
import { SettingsTab } from "@/components/settings-tab";
import type { Comparison } from "@/components/analytics-tab";
import type { RangeType } from "@/lib/dates";
import type {
  AccountDTO,
  BudgetProgressDTO,
  CategoryDTO,
  RecurringDTO,
  TransactionDTO,
} from "@/lib/queries";
import type { WorkspaceSummary } from "@/lib/workspace";

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
  recentTransactions,
  transferCount,
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
  comparison,
  recurring,
  userEmail,
  workspaces,
  activeWorkspaceId,
  workspaceName,
  isOwner,
  currentUserId,
  emailVerified,
  canEdit,
  initialTab,
  bankDemoAvailable = false,
  bankInboxAvailable = false,
  privateAccountsAvailable = false,
  finance = null,
  pilot = false,
}: {
  accounts: AccountDTO[];
  categories: CategoryDTO[];
  transactions: TransactionDTO[];
  recentTransactions: TransactionDTO[];
  transferCount: number;
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
  comparison: Comparison;
  recurring: RecurringDTO[];
  userEmail: string;
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string;
  workspaceName: string;
  isOwner: boolean;
  currentUserId: string;
  emailVerified: boolean;
  canEdit: boolean;
  initialTab: Tab;
  bankDemoAvailable?: boolean;
  bankInboxAvailable?: boolean;
  privateAccountsAvailable?: boolean;
  finance?: FinanceReport|null;
  pilot?: boolean;
}) {
  const searchParams = useSearchParams();
  const [showOriginal,setShowOriginal]=useState(false);
  const reviewedBook=!!finance?.report;
  const showOriginalTools=!reviewedBook || showOriginal;
  const requestedTab = searchParams.get("tab") ?? "overview";
  const thread = use(CommentsAvailable) && searchParams.get("thread");
  const [activeTab, setActiveTab] = useState<Tab>(() =>
    pages.some((p) => p.id === requestedTab) ? (requestedTab as Tab) : initialTab,
  );
  const tab: Tab = pages.some((p) => p.id === requestedTab)
    ? (requestedTab as Tab)
    : activeTab;
  const [moreOpen, setMoreOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<"expense" | "income" | "transfer">("expense");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K" || e.code === "KeyK") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  const showAuthors = true;
  const liveAccounts = accounts.filter((a) => !a.archived);
  const page = pages.find((p) => p.id === tab)!;

  function changeTab(value: Tab) {
    setMoreOpen(false);
    setActiveTab(value);
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
      <DeferredTools revision={accounts} key={activeWorkspaceId} workspace={activeWorkspaceId} currentEmail={userEmail} workspaceName={workspaceName} isOwner={isOwner} canEdit={canEdit} />
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
            "nav-item relative group focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50",
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
    <SettingsProvider workspace={activeWorkspaceId} actor={currentUserId} currency={currency} locale={locale}>
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

            {/* Quick Command Search in sidebar */}
            <div className="mt-3">
              <CommandSearchTrigger onClick={() => setCommandOpen(true)} />
            </div>

            {/* Quick Action Button right in sidebar */}
            {canEdit && (
              <div className="mt-2">
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
            <a href={trackerExportHref(activeWorkspaceId)} className="nav-item group">
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
                <button
                  type="button"
                  onClick={() => setCommandOpen(true)}
                  className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-border/80 bg-card/60 hover:bg-muted/70 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer active:scale-[0.98] disabled:opacity-50"
                  aria-label="Open command palette (Ctrl+K or Cmd+K)"
                >
                  <Search className="size-3.5" />
                  <span className="font-medium">Search</span>
                  <kbd className="rounded border border-border/80 bg-muted/70 px-1 font-mono text-[10px] text-muted-foreground">⌘K</kbd>
                </button>
                <button
                  type="button"
                  onClick={() => setCommandOpen(true)}
                  className="grid size-9 place-items-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground sm:hidden cursor-pointer active:scale-[0.98] disabled:opacity-50"
                  aria-label="Search"
                >
                  <Search className="size-4" />
                </button>
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
            className="mobile-nav-content mx-auto max-w-[1440px] space-y-5 px-4 pt-5 pb-28 sm:px-6 sm:pt-6 lg:pb-8 xl:px-8"
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
              {canEdit && tab !== "settings" && reviewedBook && !showOriginal && <Link href="/financial-position" className="rounded-md bg-brand px-3 py-2 text-sm text-brand-foreground">Book activity</Link>}
              {canEdit && tab !== "settings" && showOriginalTools && (
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
            {showOriginalTools && (tab === "overview" ||
              tab === "transactions" ||
              tab === "analytics") && (
              <PeriodBar
                rangeType={rangeType}
                anchor={anchor}
                rangeLabel={rangeLabel}
              />
            )}
            <div key={tab} className="surface-enter space-y-3">
              {finance && ["overview","analytics","accounts","planning","transactions"].includes(tab) && <PositionSummary data={finance}/>}
              {reviewedBook && tab!=="settings" && <div className="space-y-2 text-xs text-muted-foreground"><p>Original tracker reports, budgets and forecasts use a single display currency ({currencyCode}). They may combine accounts with different denominations.</p>
                <button type="button" aria-expanded={showOriginal} className="font-medium text-brand underline" onClick={()=>setShowOriginal(!showOriginal)}>{showOriginal?"Hide":"Show"} original tracker tools</button></div>}
              {tab === "overview" && showOriginalTools && (
                <OverviewTab
                  workspace={activeWorkspaceId}
                  accounts={accounts}
                  transactions={transactions}
                  transfers={[]}
                  recentTransactions={recentTransactions}
                  transferCount={transferCount}
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
              {tab === "transactions" && thread && <section className="dashboard-panel mb-4 space-y-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">Transaction conversation</h2>
                  <Link className="text-xs text-brand underline" href="/?tab=transactions">Close conversation</Link>
                </div>
                {searchParams.get("household") === activeWorkspaceId ? <Conversation key={thread} id={thread}/> :
                  <p className="text-sm text-muted-foreground">Switch to the household where you were mentioned to read this conversation.</p>}
              </section>}
              {tab === "transactions" && showOriginalTools && (
                <PagedActivity key={`${activeWorkspaceId}:${rangeStart}:${rangeEnd}`} start={rangeStart} end={rangeEnd} workspace={activeWorkspaceId} accounts={accounts} categories={categories} canEdit={canEdit} />
              )}
              {tab === "accounts" && showOriginalTools && (
                <div className="space-y-4">
                  {bankInboxAvailable && isOwner && <div className="dashboard-panel flex flex-wrap items-center justify-between gap-3 p-4">
                    <div><h2 className="text-sm font-semibold">Bank inbox</h2><p className="text-xs text-muted-foreground">Connect one Sandbox account to view bank activity separately.</p></div>
                    <Link href="/bank-inbox" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground">Connect bank</Link>
                  </div>}
                  {bankDemoAvailable && !bankInboxAvailable && isOwner && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
                      <div>
                        <h2 className="text-sm font-semibold">Bank connections · local demo</h2>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Try reviewing RBC and TD sample payments in a separate demo ledger.
                        </p>
                      </div>
                      <Link href="/bank-demo" className="inline-flex min-h-10 items-center rounded-lg bg-brand px-4 text-sm font-medium text-brand-foreground hover:bg-brand/90">
                        Try bank demo
                      </Link>
                    </div>
                  )}
                  <AccountsSection
                    accounts={accounts}
                    categories={categories}
                    canEdit={canEdit}
                  />
                  {canEdit && privateAccountsAvailable && <PrivateAccountsButton household={activeWorkspaceId} />}
                  {privateAccountsAvailable && <Link href="/shared-accounts" className="inline-flex min-h-9 items-center text-sm font-medium text-brand underline-offset-4 hover:underline">Accounts shared with me →</Link>}
                </div>
              )}
              {tab === "planning" && showOriginalTools && (
                <DeferredPlanning workspace={activeWorkspaceId} forecastAccounts={accounts}
                  budgets={budgetProgress}
                  categories={categories}
                  accounts={liveAccounts}
                  recurring={recurring}
                  canEdit={canEdit}
                />
              )}
              {tab === "analytics" && showOriginalTools && (
                <DeferredAnalytics workspace={activeWorkspaceId} anchor={anchor}
                  rangeType={rangeType}
                  rangeStart={rangeStart}
                  rangeEnd={rangeEnd}
                  rangeLabel={rangeLabel}
                  budgets={budgetProgress}
                  categories={categories}
                  accounts={liveAccounts}
                  recurring={recurring}
                  comparison={comparison}
                  canEdit={canEdit}
                  showAuthors={showAuthors}
                />
              )}
              {tab === "settings" && (
                <SettingsTab
                  pilot={pilot}
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
          className="mobile-tab-bar"
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
            if (isAdd && !canEdit) return null;
            const isActive = tab === id ||
              (id === "more" && ["accounts", "planning", "settings"].includes(tab));
            const button = (
              <button
                key={id}
                type="button"
                aria-label={isAdd ? "Add transaction" : label}
                aria-current={tab === id ? "page" : undefined}
                aria-expanded={id === "more" ? moreOpen : undefined}
                aria-haspopup={id === "more" ? "dialog" : undefined}
                data-active={isActive || undefined}
                onClick={
                  isAdd
                    ? undefined
                    : () => (id === "more" ? setMoreOpen(true) : changeTab(id))
                }
                className={cn(
                  "mobile-tab-item",
                  isAdd && "mobile-tab-add",
                )}
              >
                <Icon aria-hidden="true" className="mobile-tab-icon" />
                <span>{label}</span>
              </button>
            );
            return id === "add" ? (
              <TransactionDialog
                key={id}
                accounts={liveAccounts}
                categories={categories}
                trigger={button}
              />
            ) : button;
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
                <a href={trackerExportHref(activeWorkspaceId)} className="nav-item">
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
        {canEdit && (
          <TransactionDialog
            accounts={liveAccounts}
            categories={categories}
            defaultType={dialogType}
            open={dialogOpen}
            onOpenChange={setDialogOpen}
          />
        )}
        <CommandPalette
          accounts={liveAccounts}
          categories={categories}
          open={commandOpen}
          onOpenChange={setCommandOpen}
          onNavigateTab={(t) => changeTab(t as Tab)}
          onOpenNewTransaction={
            canEdit
              ? () => {
                  setDialogType("expense");
                  setDialogOpen(true);
                }
              : undefined
          }
          onOpenNewTransfer={
            canEdit
              ? () => {
                  setDialogType("transfer");
                  setDialogOpen(true);
                }
              : undefined
          }
        />
      </div>
    </SettingsProvider>
  );
}
