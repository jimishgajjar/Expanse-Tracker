"use client";

import { ArrowRight, Plus } from "lucide-react";
import { AccountsSection } from "./accounts-section";
import { SummaryCards } from "./summary-cards";
import { CategoryDonut } from "./category-donut";
import { TrendChart } from "./trend-chart";
import { TransactionDialog } from "./transaction-dialog";
import { Button } from "./ui/button";
import { TransactionRows } from "./transactions-list";
import { MoneyBrief } from "./money-brief";
import { RadarPanel } from "./radar-panel";
import { type RangeType } from "@/lib/dates";
import type {
  AccountDTO,
  BudgetProgressDTO,
  CategoryDTO,
  RecurringDTO,
  TransactionDTO,
  TransferDTO,
} from "@/lib/queries";

export function OverviewTab({
  accounts,
  transactions,
  recentTransactions = transactions,
  transferCount,
  transfers,
  categories,
  totalBalance,
  rangeLabel,
  rangeType,
  rangeStart,
  rangeEnd,
  comparison,
  canEdit = true,
  budgets,
  recurring,
  onActivity,
  onPlanning,
}: {
  accounts: AccountDTO[];
  transactions: TransactionDTO[];
  recentTransactions?: TransactionDTO[];
  transferCount?: number;
  transfers: TransferDTO[];
  categories: CategoryDTO[];
  totalBalance: number;
  rangeLabel: string;
  rangeType: RangeType;
  rangeStart: string;
  rangeEnd: string;
  comparison?: { prevIncome: number; prevExpense: number } | null;
  canEdit?: boolean;
  budgets: BudgetProgressDTO[];
  recurring: RecurringDTO[];
  onActivity: () => void;
  onPlanning: () => void;
}) {
  const income = transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const expense = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);

  const activeAccounts = accounts.filter((a) => !a.archived);
  const fresh =
    accounts.every((a) => a.income === 0 && a.expense === 0) &&
    transfers.length === 0;

  const watch = budgets
    .filter((b) => b.budget > 0 && b.spent / b.budget >= 0.8)
    .sort((a, b) => b.spent / b.budget - a.spent / a.budget);

  const upcoming = recurring
    .filter(
      (r) =>
        (!r.endDate || r.nextDate <= r.endDate) &&
        (r.maxOccurrences === null || r.occurrenceCount < r.maxOccurrences),
    )
    .sort((a, b) => a.nextDate.localeCompare(b.nextDate))
    .slice(0, 3);

  const net = income - expense;

  return (
    <div className="overview-layout space-y-5">
      {/* Onboarding State */}
      {fresh && canEdit && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/70 bg-card p-6 shadow-xs">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Welcome to your finances
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Add your first transaction to start seeing analytics, account trends, and budget tracking.
            </p>
          </div>
          <TransactionDialog
            accounts={activeAccounts}
            categories={categories}
            trigger={
              <Button className="rounded-xl font-semibold shadow-xs">
                <Plus className="size-4" />
                Add transaction
              </Button>
            }
          />
        </div>
      )}

      {/* 1. Summary Cards */}
      <SummaryCards
        totalBalance={totalBalance}
        income={income}
        expense={expense}
        net={net}
        rangeLabel={rangeLabel}
        accountsCount={accounts.length}
        comparison={comparison}
      />

      {/* 2. Accounts Section */}
      <AccountsSection
        accounts={accounts}
        categories={categories}
        canEdit={canEdit}
        showTotal={false}
      />

      <MoneyBrief recurring={recurring} budgets={budgets} expense={expense} comparison={comparison} rangeLabel={rangeLabel} />
      {/* 3. Activity & Budget Grid */}
      <div className="grid items-start gap-4 min-[1200px]:items-stretch min-[1200px]:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
        <div className="grid min-w-0">
          <section className="dashboard-panel flex flex-col justify-between p-4 sm:p-5">
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
                <div>
                  <h2 className="text-sm font-semibold tracking-tight text-foreground">
                    Recent activity
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Income and expenses · {rangeLabel}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onActivity}
                  className="group/btn gap-1 text-xs font-medium text-muted-foreground hover:text-foreground rounded-lg"
                >
                  <span>View all</span>
                  <ArrowRight className="size-3.5 transition-transform group-hover/btn:translate-x-0.5" />
                </Button>
              </div>
              <TransactionRows
                transactions={recentTransactions.slice(0, 5)}
                accounts={accounts}
                categories={categories}
                canEdit={false}
                emptyMessage="No transactions in this period."
              />
            </div>
            {(transferCount ?? transfers.length) > 0 && (
              <button
                type="button"
                onClick={onActivity}
                className="mt-3 flex min-h-11 items-center gap-1.5 text-xs font-medium text-brand hover:underline cursor-pointer sm:min-h-8"
              >
                <span>
                  View {transferCount ?? transfers.length} transfer
                  {(transferCount ?? transfers.length) === 1 ? "" : "s"}
                </span>
                <ArrowRight className="size-3.5" />
              </button>
            )}
          </section>
        </div>
        <RadarPanel watch={watch} upcoming={upcoming} onPlanning={onPlanning} />
      </div>

      {/* 4. Trend & Category Distribution */}
      <div className="grid items-start gap-4 min-[1200px]:items-stretch min-[1200px]:grid-cols-2">
        <TrendChart
          transactions={transactions}
          rangeType={rangeType}
          start={rangeStart}
          end={rangeEnd}
        />
        <CategoryDonut transactions={transactions} />
      </div>
    </div>
  );
}
