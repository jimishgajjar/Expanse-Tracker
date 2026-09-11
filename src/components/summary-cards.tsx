"use client";

import { ArrowDownLeft, ArrowUpRight, Scale } from "lucide-react";
import { useFormat } from "@/components/settings-provider";
import { cn } from "@/lib/utils";

/**
 * The page's figures, the Notion way.
 *
 * A Notion page opens with its title, then a block of *properties* — quiet
 * rows of "label · value" with a small type icon — and only then the content.
 * The total balance is the one Display-scale figure (One Hero Rule) and sits
 * directly on the canvas with no card around it; this period's income,
 * expenses and net read as the page's properties beneath it.
 */
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
  const pct = (cur: number, prev: number) => (prev ? Math.round(((cur - prev) / Math.abs(prev)) * 100) : null);
  const incDelta = comparison ? pct(income, comparison.prevIncome) : null;
  const expDelta = comparison ? pct(expense, comparison.prevExpense) : null;
  const netDelta = comparison ? pct(net, comparison.prevIncome - comparison.prevExpense) : null;

  const props = [
    { k: "Income", icon: ArrowDownLeft, v: money(income), tone: "text-positive", delta: incDelta, good: (incDelta ?? 0) >= 0, sub: rangeLabel },
    { k: "Expenses", icon: ArrowUpRight, v: money(expense), tone: "text-negative", delta: expDelta, good: (expDelta ?? 0) <= 0, sub: rangeLabel },
    {
      k: "Net",
      icon: Scale,
      v: signedMoney(net),
      tone: net < 0 ? "text-negative" : "text-positive",
      delta: netDelta,
      good: (netDelta ?? 0) >= 0,
      sub: income ? `${Math.round((net / income) * 100)}% saved` : rangeLabel,
    },
  ];

  return (
    <div>
      <div className="text-sm text-muted-foreground">Total balance</div>
      <div className={cn("amount mt-1 text-3xl leading-none font-semibold tracking-tight sm:text-4xl", totalBalance < 0 && "text-negative")}>
        {balanceMoney(totalBalance)}
      </div>
      <div className="mt-1.5 text-xs text-muted-foreground">
        across {accountsCount} account{accountsCount === 1 ? "" : "s"}
      </div>

      <dl className="mt-5 border-y border-border">
        {props.map((p) => (
          <div
            key={p.k}
            className="-mx-2 flex min-h-9 items-center gap-3 rounded-sm px-2 py-1.5 transition-colors hover:bg-hover sm:py-0"
          >
            <dt className="flex w-28 shrink-0 items-center gap-1.5 text-sm text-muted-foreground sm:w-32">
              <p.icon className="size-3.5" />
              {p.k}
            </dt>
            <dd className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className={cn("amount text-sm font-medium tabular-nums", p.tone)}>{p.v}</span>
              {p.delta != null && (
                <span className={cn("text-[11px] font-medium tabular-nums", p.good ? "text-positive" : "text-negative")}>
                  {p.delta >= 0 ? "▲" : "▼"}{Math.abs(p.delta)}%
                </span>
              )}
              <span className="truncate text-xs text-muted-foreground">{p.sub}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
