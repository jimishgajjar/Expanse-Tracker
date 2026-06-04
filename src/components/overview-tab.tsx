"use client";

import { useMemo } from "react";
import { Plus, Sparkles } from "lucide-react";
import { SummaryCards } from "@/components/summary-cards";
import { AccountsSection } from "@/components/accounts-section";
import { CategoryDonut } from "@/components/category-donut";
import { TrendChart } from "@/components/trend-chart";
import { TransactionDialog } from "@/components/transaction-dialog";
import { Button } from "@/components/ui/button";
import type { RangeType } from "@/lib/dates";
import type { AccountDTO, CategoryDTO, TransactionDTO, TransferDTO } from "@/lib/queries";

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
}) {
  const income = useMemo(() => transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0), [transactions]);
  const expense = useMemo(() => transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0), [transactions]);
  const net = income - expense;

  // Brand-new tracker: default accounts exist but nothing has ever moved through them.
  const isFresh = accounts.length > 0 && accounts.every((a) => a.income === 0 && a.expense === 0);

  return (
    <div className="space-y-5">
      {isFresh && canEdit && (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Sparkles className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <div className="font-medium">Welcome to your tracker 🎉</div>
            <p className="text-sm text-muted-foreground">It already has some default accounts and categories. Add your first transaction to bring your balances and charts to life.</p>
          </div>
          <TransactionDialog
            accounts={accounts}
            categories={categories}
            trigger={<Button className="w-full sm:w-auto"><Plus className="size-4" /> Add your first transaction</Button>}
          />
        </div>
      )}
      <SummaryCards
        totalBalance={totalBalance}
        income={income}
        expense={expense}
        net={net}
        rangeLabel={rangeLabel}
        accountsCount={accounts.length}
        comparison={comparison}
      />
      <AccountsSection accounts={accounts} transactions={transactions} transfers={transfers} categories={categories} canEdit={canEdit} />
      <div className="grid gap-4 lg:grid-cols-2">
        <CategoryDonut transactions={transactions} />
        <TrendChart transactions={transactions} rangeType={rangeType} start={rangeStart} end={rangeEnd} />
      </div>
    </div>
  );
}
