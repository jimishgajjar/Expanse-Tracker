"use client";

import { useMemo } from "react";
import { SummaryCards } from "@/components/summary-cards";
import { AccountsSection } from "@/components/accounts-section";
import { CategoryDonut } from "@/components/category-donut";
import { TrendChart } from "@/components/trend-chart";
import type { RangeType } from "@/lib/dates";
import type { AccountDTO, TransactionDTO } from "@/lib/queries";

export function OverviewTab({
  accounts,
  transactions,
  totalBalance,
  rangeLabel,
  rangeType,
  rangeStart,
  rangeEnd,
  comparison,
}: {
  accounts: AccountDTO[];
  transactions: TransactionDTO[];
  totalBalance: number;
  rangeLabel: string;
  rangeType: RangeType;
  rangeStart: string;
  rangeEnd: string;
  comparison?: { prevIncome: number; prevExpense: number } | null;
}) {
  const income = useMemo(() => transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0), [transactions]);
  const expense = useMemo(() => transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0), [transactions]);
  const net = income - expense;

  return (
    <div className="space-y-5">
      <SummaryCards
        totalBalance={totalBalance}
        income={income}
        expense={expense}
        net={net}
        rangeLabel={rangeLabel}
        accountsCount={accounts.length}
        comparison={comparison}
      />
      <AccountsSection accounts={accounts} />
      <div className="grid gap-4 lg:grid-cols-2">
        <CategoryDonut transactions={transactions} />
        <TrendChart transactions={transactions} rangeType={rangeType} start={rangeStart} end={rangeEnd} />
      </div>
    </div>
  );
}
