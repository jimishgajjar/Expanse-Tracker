"use client";

import { ArrowDownLeft, ArrowUpRight, ArrowRightLeft, ShieldCheck } from "lucide-react";
import { useFormat } from "./settings-provider";
import { cn } from "@/lib/utils";

export function SummaryCards({
  totalBalance,
  income,
  expense,
  net,
  rangeLabel,
  accountsCount,
  comparison,
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
    {
      label: "Income",
      value: money(income),
      icon: ArrowDownLeft,
      tone: "text-positive",
      badgeTone: "bg-positive/10 text-positive",
      change: incomeDelta,
      subtext:
        incomeDelta !== null
          ? `${incomeDelta > 0 ? "+" : ""}${incomeDelta}% vs prior period`
          : "Total deposits",
    },
    {
      label: "Expenses",
      value: money(expense),
      icon: ArrowUpRight,
      tone: "text-negative",
      badgeTone: "bg-negative/10 text-negative",
      change: expenseDelta,
      subtext:
        expenseDelta !== null
          ? `${expenseDelta > 0 ? "+" : ""}${expenseDelta}% vs prior period`
          : "Total spending",
    },
    {
      label: "Net cash flow",
      value: signedMoney(net),
      icon: ArrowRightLeft,
      tone: net < 0 ? "text-negative" : "text-positive",
      badgeTone: net < 0 ? "bg-negative/10 text-negative" : "bg-positive/10 text-positive",
      change: null,
      subtext:
        retained === null
          ? "Income less expenses"
          : retained >= 0
            ? `${retained}% of income retained`
            : "Expenses exceed income",
    },
  ];

  return (
    <section
      aria-label="Financial summary"
      className="balance-summary rounded-2xl border border-border/80 bg-card shadow-2xs"
    >
      <div className="balance-summary-main">
        {/* Total Balance */}
        <div className="balance-summary-total flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Total balance
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
                <span className="size-1.5 rounded-full bg-brand animate-pulse" />
                Live
              </span>
            </div>
            <h2
              className={cn(
                "amount mt-2 break-words text-[clamp(1.75rem,2.8vw,2.4rem)] font-bold leading-tight tracking-tight",
                totalBalance < 0 ? "text-negative" : "text-foreground",
              )}
            >
              {balanceMoney(totalBalance)}
            </h2>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-brand" />
              <span>
                {accountsCount} active {accountsCount === 1 ? "account" : "accounts"}
              </span>
            </span>
            <span className="text-[11px] font-medium text-foreground">Verified</span>
          </div>
        </div>

        {/* Period Cash Flow */}
        <div className="balance-summary-period">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              Cash flow <span className="font-normal text-foreground">· {rangeLabel}</span>
            </p>
            <span className="text-[11px] text-muted-foreground">Excludes transfers</span>
          </div>

          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {metrics.map(({ label, value, icon: MetricIcon, tone, badgeTone, subtext }) => (
              <div
                key={label}
                className="group min-w-0 transition-colors duration-150 motion-reduce:transition-none"
              >
                <dt className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                  <span>{label}</span>
                  <span className={cn("grid size-6 place-items-center rounded-lg", badgeTone)}>
                    <MetricIcon className="size-3.5" aria-hidden />
                  </span>
                </dt>
                <dd className={cn("amount mt-2 break-words text-lg font-bold tracking-tight", tone)}>
                  {value}
                </dd>
                <dd className="mt-1.5 text-[11px] text-muted-foreground truncate">
                  {subtext}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* Footer Note */}
      <div className="balance-summary-note flex items-center justify-between border-t border-border/60 bg-muted/20 px-4 py-2.5 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-brand" aria-hidden />
          Total balance includes internal transfers. Cash flow aggregates external activity only.
        </span>
        <span className="hidden sm:inline font-medium text-foreground">
          Display currency
        </span>
      </div>
    </section>
  );
}
