"use client";

import { useState } from "react";
import { Download, Plus, Repeat, Settings, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/theme-toggle";
import { SettingsProvider } from "@/components/settings-provider";
import { SettingsDialog } from "@/components/settings-dialog";
import { CategoryManager } from "@/components/category-manager";
import { RecurringManager } from "@/components/recurring-manager";
import { TransactionDialog } from "@/components/transaction-dialog";
import { PeriodBar } from "@/components/period-bar";
import { OverviewTab } from "@/components/overview-tab";
import { TransactionsTab } from "@/components/transactions-tab";
import { AnalyticsTab, type Comparison } from "@/components/analytics-tab";
import type { RangeType } from "@/lib/dates";
import type { AccountDTO, BudgetProgressDTO, CategoryDTO, NetWorthPoint, RecurringDTO, TransactionDTO, TransferDTO } from "@/lib/queries";

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
  authEnabled,
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
  authEnabled: boolean;
  initialTab: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);

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
      <div className="mx-auto max-w-6xl space-y-4 px-3 py-5 sm:space-y-5 sm:px-6 sm:py-6">
        <header className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="mr-auto">
            <h1 className="text-lg font-semibold tracking-tight sm:text-xl">Money Tracker</h1>
            <p className="hidden text-sm text-muted-foreground sm:block">Income, expenses, accounts &amp; categories.</p>
          </div>
          <CategoryManager
            categories={categories}
            trigger={<Button variant="outline" size="sm" aria-label="Categories"><Tags className="size-4" /><span className="hidden sm:inline">Categories</span></Button>}
          />
          <RecurringManager
            recurring={recurring}
            accounts={accounts}
            categories={categories}
            trigger={<Button variant="outline" size="sm" aria-label="Recurring"><Repeat className="size-4" /><span className="hidden sm:inline">Recurring</span></Button>}
          />
          <Button variant="outline" size="sm" aria-label="Export to Excel" onClick={() => window.location.assign("/api/export")}>
            <Download className="size-4" /><span className="hidden sm:inline">Export</span>
          </Button>
          <TransactionDialog
            accounts={accounts}
            categories={categories}
            trigger={<Button size="sm"><Plus className="size-4" /> Add<span className="hidden sm:inline"> transaction</span></Button>}
          />
          <SettingsDialog
            currencyCode={currencyCode}
            authEnabled={authEnabled}
            trigger={<Button variant="ghost" size="icon" aria-label="Settings"><Settings className="size-4" /></Button>}
          />
          <ThemeToggle />
        </header>

        <PeriodBar rangeType={rangeType} anchor={anchor} rangeLabel={rangeLabel} />

        <Tabs value={tab} onValueChange={(v) => changeTab(v as Tab)}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === "overview" && (
          <OverviewTab
            accounts={accounts}
            transactions={transactions}
            totalBalance={totalBalance}
            rangeLabel={rangeLabel}
            rangeType={rangeType}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            comparison={comparison}
          />
        )}
        {tab === "transactions" && (
          <TransactionsTab transactions={transactions} transfers={transfers} accounts={accounts} categories={categories} />
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
    </SettingsProvider>
  );
}
