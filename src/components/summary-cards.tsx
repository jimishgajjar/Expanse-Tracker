"use client";

import { ArrowDownLeft, ArrowUpRight, ArrowRightLeft } from "lucide-react";
import { useFormat } from "./settings-provider";
import { cn } from "@/lib/utils";

export function SummaryCards({
  totalBalance, income, expense, net, rangeLabel, accountsCount, comparison,
}: {
  totalBalance: number;
  income: number;
  expense: number;
  net: number;
  rangeLabel: string;
  accountsCount: number;
  comparison?: { prevIncome: number; prevExpense: number } | null;
}) {
  const { money, signedMoney, balanceMoney } = useFormat();
  const delta = (current: number, previous?: number) =>
    previous ? Math.round(((current - previous) / Math.abs(previous)) * 100) : null;
  const incomeDelta = delta(income, comparison?.prevIncome);
  const expenseDelta = delta(expense, comparison?.prevExpense);
  const retained = income > 0 ? Math.round((net / income) * 100) : null;
  const metrics = [
    { label: "Income", value: money(income), icon: ArrowDownLeft, tone: "text-positive", change: incomeDelta },
    { label: "Expenses", value: money(expense), icon: ArrowUpRight, tone: "text-negative", change: expenseDelta },
    { label: "Net cash flow", value: signedMoney(net), icon: ArrowRightLeft, tone: net < 0 ? "text-negative" : "text-positive", change: null },
  ];

  return (
    <section aria-label="Financial summary" className="balance-summary">
      <div className="balance-summary-main">
        <div className="balance-summary-total">
          <p className="text-xs font-medium text-muted-foreground">Total balance</p>
          <h2 className={cn("amount mt-2 break-words text-[clamp(1.6rem,2.5vw,2.2rem)] font-semibold leading-tight tracking-[-0.04em]", totalBalance < 0 && "text-negative")}>
            {balanceMoney(totalBalance)}
          </h2>
          <p className="mt-2 text-xs text-muted-foreground">
            Current balance · {accountsCount} {accountsCount === 1 ? "account" : "accounts"}
          </p>
        </div>
        <div className="balance-summary-period">
          <p className="mb-4 text-xs text-muted-foreground">Cash flow <span className="text-foreground">· {rangeLabel}</span></p>
          <dl className="balance-summary-metrics">
            {metrics.map(({ label, value, icon: MetricIcon, tone, change }) => (
              <div key={label} className="min-w-0">
                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MetricIcon className={cn("size-3.5", tone)} aria-hidden />
                  {label}
                </dt>
                <dd className={cn("amount mt-2 break-words text-xl font-semibold tracking-tight", tone)}>{value}</dd>
                {label === "Net cash flow" ? (
                  <dd className="mt-1.5 text-[11px] text-muted-foreground">
                    {retained === null ? "Income less expenses" : retained >= 0 ? `${retained}% of income retained` : "Expenses exceed income"}
                  </dd>
                ) : change !== null ? (
                  <dd className="mt-1.5 text-[11px] text-muted-foreground">
                    {`${change > 0 ? "+" : ""}${change}% vs prior period`}
                  </dd>
                ) : null}
              </div>
            ))}
          </dl>
        </div>
      </div>
      <div className="balance-summary-note">
        <span className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-brand" aria-hidden />Your balance includes transfers. Cash flow excludes them.</span>
        <span className="hidden sm:inline">All amounts in your display currency</span>
      </div>
    </section>
  );
}
