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
}: {
  totalBalance: number;
  income: number;
  expense: number;
  net: number;
  rangeLabel: string;
  accountsCount: number;
}) {
  const { money, signedMoney, balanceMoney } = useFormat();
  const tiles = [
    { k: "Total balance", v: balanceMoney(totalBalance), sub: `across ${accountsCount} account${accountsCount === 1 ? "" : "s"}`, Icon: Wallet, tone: "", vClass: totalBalance < 0 ? "text-negative" : "" },
    { k: "Income", v: money(income), sub: rangeLabel, Icon: TrendingUp, tone: "text-positive", vClass: "text-positive" },
    { k: "Expenses", v: money(expense), sub: rangeLabel, Icon: TrendingDown, tone: "text-negative", vClass: "text-negative" },
    { k: "Net", v: signedMoney(net), sub: income ? `${Math.round((net / income) * 100)}% of income saved` : rangeLabel, Icon: Scale, tone: net < 0 ? "text-negative" : "text-positive", vClass: net < 0 ? "text-negative" : "text-positive" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((t) => (
        <Card key={t.k} className="gap-0 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">{t.k}</span>
            <t.Icon className={cn("size-4 text-muted-foreground", t.tone)} />
          </div>
          <div className={cn("mt-2 font-mono text-2xl font-semibold tracking-tight", t.vClass)}>{t.v}</div>
          <div className="mt-1 truncate text-xs text-muted-foreground">{t.sub}</div>
        </Card>
      ))}
    </div>
  );
}
