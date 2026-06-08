"use client";

import { Scale, TrendingDown, TrendingUp, Wallet } from "lucide-react";
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

  const tiles = [
    { k: "Total balance", v: balanceMoney(totalBalance), sub: `across ${accountsCount} account${accountsCount === 1 ? "" : "s"}`, Icon: Wallet, chip: "bg-brand/10 text-brand", vClass: totalBalance < 0 ? "text-negative" : "", delta: null as number | null, good: true },
    { k: "Income", v: money(income), sub: rangeLabel, Icon: TrendingUp, chip: "bg-positive/10 text-positive", vClass: "text-positive", delta: incDelta, good: (incDelta ?? 0) >= 0 },
    { k: "Expenses", v: money(expense), sub: rangeLabel, Icon: TrendingDown, chip: "bg-negative/10 text-negative", vClass: "text-negative", delta: expDelta, good: (expDelta ?? 0) <= 0 },
    { k: "Net", v: signedMoney(net), sub: income ? `${Math.round((net / income) * 100)}% saved` : rangeLabel, Icon: Scale, chip: net < 0 ? "bg-negative/10 text-negative" : "bg-positive/10 text-positive", vClass: net < 0 ? "text-negative" : "text-positive", delta: netDelta, good: (netDelta ?? 0) >= 0 },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((t) => (
        <Card key={t.k} className="gap-0 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">{t.k}</span>
            <span className={cn("grid size-7 place-items-center rounded-lg", t.chip)}><t.Icon className="size-4" /></span>
          </div>
          <div className={cn("amount mt-3 text-xl font-semibold tracking-tight sm:text-[1.7rem]", t.vClass)}>{t.v}</div>
          <div className="mt-1.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            {t.delta != null && (
              <span className={cn("font-medium", t.good ? "text-positive" : "text-negative")}>
                {t.delta >= 0 ? "▲" : "▼"}{Math.abs(t.delta)}%
              </span>
            )}
            <span className="truncate">{t.sub}</span>
          </div>
        </Card>
      ))}
    </div>
  );
}
