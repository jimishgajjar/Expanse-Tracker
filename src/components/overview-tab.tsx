"use client";
import { ArrowRight, Plus } from "lucide-react";
import { AccountsSection } from "./accounts-section";
import { SummaryCards } from "./summary-cards";
import { CategoryDonut } from "./category-donut";
import { TrendChart } from "./trend-chart";
import { TransactionDialog } from "./transaction-dialog";
import { Button } from "./ui/button";
import { TransactionRows } from "./transactions-list";
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
      .reduce((s, t) => s + t.amount, 0),
    expense = transactions
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
  return (
    <div className="space-y-4">
      {fresh && canEdit && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-brand/30 bg-gradient-to-r from-brand/10 via-card to-background p-5 shadow-xs">
          <div>
            <h2 className="text-base font-bold tracking-tight text-foreground">
              Your money, all in one calm place.
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Start by logging your first expense or income. Your accounts and default categories are ready.
            </p>
          </div>
          <TransactionDialog
            accounts={activeAccounts}
            categories={categories}
            trigger={
              <Button className="rounded-xl font-semibold shadow-xs">
                <Plus className="size-4" />
                Add your first transaction
              </Button>
            }
          />
        </div>
      )}
      <SummaryCards
        totalBalance={totalBalance}
        income={income}
        expense={expense}
        net={income - expense}
        rangeLabel={rangeLabel}
        accountsCount={accounts.length}
        comparison={comparison}
      />
      <AccountsSection
        accounts={accounts}
        categories={categories}
        canEdit={canEdit}
      />
      <div className="grid items-start gap-4 xl:items-stretch xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
        <div className="grid min-w-0">
          <section className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
            <div className="mb-3 flex items-center justify-between gap-2 border-b border-border/60 pb-3">
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-foreground">
                  Recent activity
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Income and expenses · {rangeLabel}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onActivity}
                className="group gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                <span>All activity</span>
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </div>
            <TransactionRows
              transactions={transactions.slice(0, 5)}
              accounts={accounts}
              categories={categories}
              canEdit={false}
              emptyMessage="No transactions in this period. Add one or choose a different period."
            />
            {transfers.length > 0 && (
              <button
                type="button"
                onClick={onActivity}
                className="mt-3 flex items-center gap-1.5 text-xs font-medium text-brand hover:underline"
              >
                <span>
                  View {transfers.length} transfer
                  {transfers.length === 1 ? "" : "s"} in Activity
                </span>
                <ArrowRight className="size-3.5" />
              </button>
            )}
          </section>
        </div>
        <RadarPanel watch={watch} upcoming={upcoming} onPlanning={onPlanning} />
      </div>
      <div className="grid items-start gap-4 xl:items-stretch xl:grid-cols-2">
        <div className="grid min-w-0">
          <TrendChart
            transactions={transactions}
            rangeType={rangeType}
            start={rangeStart}
            end={rangeEnd}
          />
        </div>
        <div className="grid min-w-0">
          <CategoryDonut transactions={transactions} />
        </div>
      </div>
    </div>
  );
}
