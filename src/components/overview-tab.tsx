"use client";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Plus,
} from "lucide-react";
import { AccountsSection } from "./accounts-section";
import { SummaryCards } from "./summary-cards";
import { CategoryDonut } from "./category-donut";
import { TrendChart } from "./trend-chart";
import { TransactionDialog } from "./transaction-dialog";
import { Button } from "./ui/button";
import { TransactionRows } from "./transactions-list";
import { useFormat } from "./settings-provider";
import { todayISO, type RangeType } from "@/lib/dates";
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
  const { money } = useFormat();
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
    <div className="space-y-6">
      {fresh && canEdit && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/20 bg-brand/5 p-4">
          <div>
            <h2 className="font-medium">Your money, all in one place.</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Start with an expense or income. Your accounts and categories are
              ready.
            </p>
          </div>
          <TransactionDialog
            accounts={activeAccounts}
            categories={categories}
            trigger={
              <Button>
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
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
        <div className="min-w-0 space-y-6">
          <TrendChart
            transactions={transactions}
            rangeType={rangeType}
            start={rangeStart}
            end={rangeEnd}
          />
          <section className="rounded-2xl border bg-card p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold">Recent transactions</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Income and expenses · {rangeLabel}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={onActivity}>
                All activity
                <ArrowRight className="size-4" />
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
                className="mt-3 min-h-11 text-sm text-brand"
              >
                View {transfers.length} transfer
                {transfers.length === 1 ? "" : "s"} in Activity{" "}
                <ArrowRight className="ml-1 inline size-4" />
              </button>
            )}
          </section>
        </div>
        <div className="min-w-0 space-y-6">
          <section className="rounded-2xl border bg-card p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">On your radar</h2>
              <CalendarDays className="size-[18px] text-muted-foreground" />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Current budgets & upcoming payments
            </p>
            <div className="mt-4 divide-y">
              {watch.slice(0, 2).map((b) => (
                <button
                  key={b.categoryId}
                  type="button"
                  onClick={onPlanning}
                  className="flex min-h-16 w-full items-center justify-between gap-3 py-3 text-left"
                >
                  <div>
                    <p className="text-sm font-medium">{b.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {b.spent >= b.budget
                        ? "Monthly limit reached"
                        : "Approaching monthly limit"}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-negative">
                    {Math.round((b.spent / b.budget) * 100)}%
                  </span>
                </button>
              ))}
              {upcoming.map((r) => (
                <button
                  type="button"
                  key={r.id}
                  onClick={onPlanning}
                  className="flex min-h-16 w-full items-center justify-between gap-3 py-3 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {r.note ||
                        (r.type === "income"
                          ? "Recurring income"
                          : "Recurring payment")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {r.nextDate < todayISO() ? "Due" : "Next"} · {r.nextDate}
                      {!r.autoPost && " · log actual amount"}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-medium">
                    {money(r.amount)}
                    {!r.autoPost && (
                      <span className="block text-right text-xs text-muted-foreground">
                        estimate
                      </span>
                    )}
                  </span>
                </button>
              ))}
              {!watch.length && !upcoming.length && (
                <p className="flex items-start gap-2 py-5 text-sm text-muted-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand" />
                  No budget warnings or scheduled payments. Set up your plan
                  when you are ready.
                </p>
              )}
            </div>
            <Button
              variant="outline"
              className="mt-3 w-full"
              onClick={onPlanning}
            >
              Open planning
              <ArrowRight className="size-4" />
            </Button>
          </section>
        </div>
      </div>
      <CategoryDonut transactions={transactions} />
    </div>
  );
}
