"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendChart } from "@/components/trend-chart";
import { Icon } from "@/components/icon";
import { useFormat } from "@/components/settings-provider";
import { colorFor } from "@/lib/colors";
import { cn } from "@/lib/utils";
import type { RangeType } from "@/lib/dates";
import type { TransactionDTO } from "@/lib/queries";

type Item = { name: string; value: number; count: number; color: string; icon: string };

function aggregate(list: TransactionDTO[], by: "category" | "account"): Item[] {
  const map = new Map<string, Item>();
  for (const t of list) {
    const ref = by === "category" ? t.category : t.account;
    const name = ref?.name ?? (by === "category" ? "Uncategorised" : "—");
    const item = map.get(name) ?? {
      name,
      value: 0,
      count: 0,
      color: ref?.color ?? colorFor(name),
      icon: ref?.icon ?? (by === "category" ? "circle-help" : "wallet"),
    };
    item.value += t.amount;
    item.count += 1;
    map.set(name, item);
  }
  return [...map.values()].sort((a, b) => b.value - a.value);
}

export function AnalyticsTab({
  transactions,
  rangeType,
  rangeStart,
  rangeEnd,
}: {
  transactions: TransactionDTO[];
  rangeType: RangeType;
  rangeStart: string;
  rangeEnd: string;
}) {
  const { money } = useFormat();

  const a = useMemo(() => {
    const expenses = transactions.filter((t) => t.type === "expense");
    const incomes = transactions.filter((t) => t.type === "income");
    const totalExpense = expenses.reduce((s, t) => s + t.amount, 0);
    const totalIncome = incomes.reduce((s, t) => s + t.amount, 0);
    const net = totalIncome - totalExpense;
    const expenseDays = new Set(expenses.map((t) => t.date)).size;
    return {
      expenses,
      incomes,
      totalExpense,
      totalIncome,
      net,
      savingsRate: totalIncome ? Math.round((net / totalIncome) * 100) : 0,
      avgExpense: expenses.length ? totalExpense / expenses.length : 0,
      biggestExpense: expenses.reduce((m, t) => Math.max(m, t.amount), 0),
      avgPerDay: expenseDays ? totalExpense / expenseDays : 0,
      expenseByCat: aggregate(expenses, "category"),
      incomeByCat: aggregate(incomes, "category"),
      byAccount: aggregate(expenses, "account"),
    };
  }, [transactions]);

  if (!transactions.length) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          No data in this period — add transactions or widen the range.
        </CardContent>
      </Card>
    );
  }

  const stats = [
    { k: "Income", v: money(a.totalIncome), tone: "text-positive" },
    { k: "Expenses", v: money(a.totalExpense), tone: "text-negative" },
    { k: "Net", v: `${a.net < 0 ? "−" : "+"}${money(a.net)}`, tone: a.net < 0 ? "text-negative" : "text-positive" },
    { k: "Savings rate", v: `${a.savingsRate}%`, tone: "" },
    { k: "Transactions", v: String(transactions.length), tone: "" },
    { k: "Avg. expense", v: money(a.avgExpense), tone: "" },
    { k: "Biggest expense", v: money(a.biggestExpense), tone: "" },
    { k: "Avg. spend / active day", v: money(a.avgPerDay), tone: "" },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.k} className="gap-0 p-3.5">
            <div className="text-xs font-medium text-muted-foreground">{s.k}</div>
            <div className={cn("mt-1.5 font-mono text-lg font-semibold tracking-tight sm:text-xl", s.tone)}>{s.v}</div>
          </Card>
        ))}
      </div>

      <TrendChart transactions={transactions} rangeType={rangeType} start={rangeStart} end={rangeEnd} />

      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownCard title="Expenses by category" items={a.expenseByCat} total={a.totalExpense} money={money} />
        <BreakdownCard title="Income by source" items={a.incomeByCat} total={a.totalIncome} money={money} />
      </div>

      <BreakdownCard title="Spending by account" items={a.byAccount} total={a.totalExpense} money={money} />
    </div>
  );
}

function BreakdownCard({
  title,
  items,
  total,
  money,
}: {
  title: string;
  items: Item[];
  total: number;
  money: (n: number) => string;
}) {
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nothing here yet.</p>
        ) : (
          <ul className="space-y-3">
            {items.map((it) => {
              const pct = total ? Math.round((it.value / total) * 100) : 0;
              return (
                <li key={it.name}>
                  <div className="mb-1 flex items-center gap-2 text-sm">
                    <span className="grid size-6 shrink-0 place-items-center rounded" style={{ backgroundColor: `${it.color}22`, color: it.color }}>
                      <Icon name={it.icon} size={13} />
                    </span>
                    <span className="flex-1 truncate">{it.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{it.count}×</span>
                    <span className="w-24 text-right font-mono text-xs font-medium">{money(it.value)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: it.color }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
