"use client";

import { useState } from "react";
import { Download, Plus, Settings, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/theme-toggle";
import { SettingsProvider } from "@/components/settings-provider";
import { SettingsDialog } from "@/components/settings-dialog";
import { CategoryManager } from "@/components/category-manager";
import { TransactionDialog } from "@/components/transaction-dialog";
import { PeriodBar } from "@/components/period-bar";
import { OverviewTab } from "@/components/overview-tab";
import { TransactionsTab } from "@/components/transactions-tab";
import { AnalyticsTab } from "@/components/analytics-tab";
import type { RangeType } from "@/lib/dates";
import type { AccountDTO, CategoryDTO, TransactionDTO } from "@/lib/queries";

export function Dashboard({
  accounts,
  categories,
  transactions,
  rangeType,
  anchor,
  rangeLabel,
  rangeStart,
  rangeEnd,
  totalBalance,
  currency,
  locale,
  currencyCode,
}: {
  accounts: AccountDTO[];
  categories: CategoryDTO[];
  transactions: TransactionDTO[];
  rangeType: RangeType;
  anchor: string;
  rangeLabel: string;
  rangeStart: string;
  rangeEnd: string;
  totalBalance: number;
  currency: string;
  locale: string;
  currencyCode: string;
}) {
  const [tab, setTab] = useState<"overview" | "transactions" | "analytics">("overview");

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
            trigger={<Button variant="ghost" size="icon" aria-label="Settings"><Settings className="size-4" /></Button>}
          />
          <ThemeToggle />
        </header>

        <PeriodBar rangeType={rangeType} anchor={anchor} rangeLabel={rangeLabel} />

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
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
          />
        )}
        {tab === "transactions" && (
          <TransactionsTab transactions={transactions} accounts={accounts} categories={categories} />
        )}
        {tab === "analytics" && (
          <AnalyticsTab transactions={transactions} rangeType={rangeType} rangeStart={rangeStart} rangeEnd={rangeEnd} />
        )}
      </div>
    </SettingsProvider>
  );
}
