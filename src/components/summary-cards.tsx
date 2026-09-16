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
      <div className="flex flex-wrap items-end justify-between gap-4 px-5 py-6 sm:px-7 sm:py-7">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Total balance
          </p>
          <p
            className={cn(
              "amount mt-2 break-all text-4xl font-semibold leading-tight tracking-tight sm:text-[2.75rem]",
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
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          Cash flow below · {rangeLabel}
        </p>
      </div>
      <dl className="grid grid-cols-1 divide-y border-t bg-canvas-muted sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between gap-4 px-5 py-4 sm:block sm:px-7 sm:py-5"
          >
            <dt className="flex items-center gap-2 text-sm text-muted-foreground">
              <item.icon className="size-4" />
              {item.label}
            </dt>
            <dd className="text-right sm:mt-2 sm:text-left">
              <span
                className={cn(
                  "amount break-all text-lg font-semibold sm:text-xl",
                  item.tone,
                )}
              >
                {item.value}
              </span>
              {item.change !== null && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.change > 0 ? "+" : ""}
                  {item.change}% vs previous period
                </p>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
