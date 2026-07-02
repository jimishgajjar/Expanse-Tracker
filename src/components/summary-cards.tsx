"use client";

import { Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useFormat } from "@/components/settings-provider";
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
  const pct = (cur: number, prev: number) => (prev ? Math.round(((cur - prev) / Math.abs(prev)) * 100) : null);
  const incDelta = comparison ? pct(income, comparison.prevIncome) : null;
  const expDelta = comparison ? pct(expense, comparison.prevExpense) : null;
  const netDelta = comparison ? pct(net, comparison.prevIncome - comparison.prevExpense) : null;

  const stats = [
    { k: "Income", v: money(income), tone: "text-positive", delta: incDelta, good: (incDelta ?? 0) >= 0, sub: rangeLabel },
    { k: "Expenses", v: money(expense), tone: "text-negative", delta: expDelta, good: (expDelta ?? 0) <= 0, sub: rangeLabel },
    {
      k: "Net",
      v: signedMoney(net),
      tone: net < 0 ? "text-negative" : "text-positive",
      delta: netDelta,
      good: (netDelta ?? 0) >= 0,
      sub: income ? `${Math.round((net / income) * 100)}% saved` : rangeLabel,
    },
  ];

  return (
    <div className="space-y-3">
      {/* The one hero figure on this screen (The One Hero Rule): total balance
          on a faint emerald wash — the brand carries the number, not chrome. */}
      <Card className="gap-0 bg-[color-mix(in_oklch,var(--brand)_4.5%,var(--card))] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-medium text-muted-foreground">Total balance</span>
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand text-brand-foreground shadow-sm shadow-brand/25">
            <Wallet className="size-4" />
          </span>
        </div>
        <div className={cn("amount mt-1.5 text-[2rem] leading-none font-semibold tracking-tight sm:text-4xl", totalBalance < 0 && "text-negative")}>
          {balanceMoney(totalBalance)}
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          across {accountsCount} account{accountsCount === 1 ? "" : "s"}
        </div>
      </Card>

      {/* This period, as one ledger strip — three figures separated by hairlines. */}
      <Card className="grid grid-cols-3 gap-0 divide-x divide-border p-0">
        {stats.map((s) => (
          <div key={s.k} className="min-w-0 px-3 py-3 sm:px-4">
            <div className="truncate text-xs font-medium text-muted-foreground">{s.k}</div>
            <div className={cn("amount mt-1 truncate text-[0.95rem] font-semibold tracking-tight sm:text-xl", s.tone)}>{s.v}</div>
            <div className="mt-1 flex items-center gap-1 truncate text-[11px] text-muted-foreground sm:text-xs">
              {s.delta != null && (
                <span className={cn("shrink-0 font-medium", s.good ? "text-positive" : "text-negative")}>
                  {s.delta >= 0 ? "▲" : "▼"}{Math.abs(s.delta)}%
                </span>
              )}
              <span className="truncate">{s.sub}</span>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
