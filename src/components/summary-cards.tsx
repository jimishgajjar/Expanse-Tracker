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
      className="overflow-hidden rounded-2xl border bg-card"
    >
      <div className="flex flex-wrap items-end justify-between gap-2 px-4 py-4 sm:px-5">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Total balance
          </p>
          <p
            className={cn(
              "amount mt-1 break-all text-3xl font-semibold leading-tight tracking-tight sm:text-4xl",
              totalBalance < 0 && "text-negative",
            )}
          >
            {balanceMoney(totalBalance)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Current balance across {accountsCount} account
            {accountsCount === 1 ? "" : "s"}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Cash flow · {rangeLabel}
        </p>
      </div>
      <dl className="grid grid-cols-3 divide-x border-t bg-canvas-muted">
        {items.map((item) => (
          <div key={item.label} className="min-w-0 px-3 py-3 sm:px-5">
            <dt className="flex items-center gap-2 text-xs text-muted-foreground">
              <item.icon className="hidden size-3.5 sm:block" />
              {item.label}
            </dt>
            <dd className="mt-1.5">
              <span
                className={cn(
                  "amount break-all text-sm font-semibold sm:text-lg",
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
