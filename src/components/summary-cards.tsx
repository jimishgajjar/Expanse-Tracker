"use client";
import { ArrowDownLeft, ArrowUpRight, ArrowRightLeft } from "lucide-react";
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
  const delta = (v: number, p?: number) =>
    p ? Math.round(((v - p) / Math.abs(p)) * 100) : null;
  const items = [
    {
      label: "Income",
      value: money(income),
      icon: ArrowDownLeft,
      tone: "text-positive",
      change: delta(income, comparison?.prevIncome),
    },
    {
      label: "Spending",
      value: money(expense),
      icon: ArrowUpRight,
      tone: "text-negative",
      change: delta(expense, comparison?.prevExpense),
    },
    {
      label: "Net this period",
      value: signedMoney(net),
      icon: ArrowRightLeft,
      tone: net < 0 ? "text-negative" : "text-positive",
      change: null,
    },
  ];
  return (
    <section
      aria-label="Balance and cash flow"
      className="overflow-hidden rounded-xl border bg-card lg:grid lg:grid-cols-[minmax(220px,1fr)_2fr]"
    >
      <div className="flex flex-wrap items-end justify-between gap-2 px-4 py-3 lg:block">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Total balance
          </p>
          <p
            className={cn(
              "amount mt-1 break-all text-2xl font-semibold leading-tight tracking-tight sm:text-[1.75rem]",
              totalBalance < 0 && "text-negative",
            )}
          >
            {balanceMoney(totalBalance)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Current balance across {accountsCount} account
            {accountsCount === 1 ? "" : "s"}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Cash flow · {rangeLabel}
        </p>
      </div>
      <dl className="grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0 border-t bg-canvas-muted lg:items-center lg:border-t-0 lg:border-l">
        {items.map((item) => (
          <div key={item.label} className="flex min-w-0 items-center justify-between gap-2 px-4 py-2.5 sm:block">
            <dt className="flex items-center gap-2 text-xs text-muted-foreground">
              <item.icon className="hidden size-3.5 sm:block" />
              {item.label}
            </dt>
            <dd className="sm:mt-1">
              <span
                className={cn(
                  "amount break-all text-sm font-semibold sm:text-base",
                  item.tone,
                )}
              >
                {item.value}
              </span>
              {item.change !== null && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.change > 0 ? "+" : ""}
                  {item.change}%
                  <span className="sr-only sm:not-sr-only">
                    {" "}
                    vs previous period
                  </span>
                </p>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
