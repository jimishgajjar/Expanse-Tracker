"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendChart } from "@/components/trend-chart";
import { NetWorthChart } from "@/components/net-worth-chart";
import { BudgetsCard } from "@/components/budgets-card";
import { Icon } from "@/components/icon";
import { useFormat } from "@/components/settings-provider";
import { colorFor } from "@/lib/colors";
import { cn } from "@/lib/utils";
import type { RangeType } from "@/lib/dates";
import type { BudgetProgressDTO, CategoryDTO, NetWorthPoint, TransactionDTO } from "@/lib/queries";

type Item = { name: string; value: number; count: number; color: string; icon: string };
export type Comparison = { prevIncome: number; prevExpense: number } | null;

function aggregate(list: TransactionDTO[], by: "category" | "account"): Item[] {
  const map = new Map<string, Item>();
  for (const t of list) {
    const ref = by === "category" ? t.category : t.account;
    const name = ref?.name ?? (by === "category" ? "Uncategorised" : "—");
    const item = map.get(name) ?? {
      name, value: 0, count: 0,
      color: ref?.color ?? colorFor(name),
      icon: ref?.icon ?? (by === "category" ? "circle-help" : "wallet"),
    };
    item.value += t.amount;
    item.count += 1;
    map.set(name, item);
  }
  return [...map.values()].sort((a, b) => b.value - a.value);
}

function pctChange(cur: number, prev: number): number | null {
  if (!prev) return null;
  return Math.round(((cur - prev) / Math.abs(prev)) * 100);
}

export function AnalyticsTab({
  transactions,
  rangeType,
  rangeStart,
  rangeEnd,
  budgets,
  categories,
  netWorth,
  comparison,
}: {
  transactions: TransactionDTO[];
  rangeType: RangeType;
  rangeStart: string;
  rangeEnd: string;
  budgets: BudgetProgressDTO[];
  categories: CategoryDTO[];
  netWorth: NetWorthPoint[];
  comparison: Comparison;
}) {
  const { money } = useFormat();

  const a = useMemo(() => {
    const expenses = transactions.filter((t) => t.type === "expense");
    const incomes = transactions.filter((t) => t.type === "income");
    const totalExpense = expenses.reduce((s, t) => s + t.amount, 0);
    const totalIncome = incomes.reduce((s, t) => s + t.amount, 0);
    const net = totalIncome - totalExpense;
    const expenseDays = new Set(expenses.map((t) => t.date)).size;

    const merchants = new Map<string, Item>();
    for (const t of expenses) {
      const note = t.note.trim();
      if (!note) continue;
      const key = note.toLowerCase();
      const m = merchants.get(key) ?? { name: note, value: 0, count: 0, color: t.category?.color ?? "#94a3b8", icon: t.category?.icon ?? "circle-help" };
      m.value += t.amount; m.count += 1; merchants.set(key, m);
    }

    return {
      totalExpense, totalIncome, net,
      savingsRate: totalIncome ? Math.round((net / totalIncome) * 100) : 0,
      avgExpense: expenses.length ? totalExpense / expenses.length : 0,
      biggestExpense: expenses.reduce((m, t) => Math.max(m, t.amount), 0),
      avgPerDay: expenseDays ? totalExpense / expenseDays : 0,
      expenseByCat: aggregate(expenses, "category"),
      incomeByCat: aggregate(incomes, "category"),
      byAccount: aggregate(expenses, "account"),
      topMerchants: [...merchants.values()].sort((x, y) => y.value - x.value).slice(0, 6),
      largest: [...transactions].sort((x, y) => y.amount - x.amount).slice(0, 6),
    };
  }, [transactions]);

  if (!transactions.length) {
    return (
      <div className="space-y-5">
        <NetWorthChart series={netWorth} />
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No transactions in this period — widen the range to see analytics.
          </CardContent>
        </Card>
      </div>
    );
  }

  const incomeDelta = comparison ? pctChange(a.totalIncome, comparison.prevIncome) : null;
  const expenseDelta = comparison ? pctChange(a.totalExpense, comparison.prevExpense) : null;
  const stats = [
    { k: "Income", v: money(a.totalIncome), tone: "text-positive", delta: incomeDelta, deltaGood: (incomeDelta ?? 0) >= 0 },
    { k: "Expenses", v: money(a.totalExpense), tone: "text-negative", delta: expenseDelta, deltaGood: (expenseDelta ?? 0) <= 0 },
    { k: "Net", v: `${a.net < 0 ? "−" : "+"}${money(a.net)}`, tone: a.net < 0 ? "text-negative" : "text-positive" },
    { k: "Savings rate", v: `${a.savingsRate}%` },
    { k: "Transactions", v: String(transactions.length) },
    { k: "Avg. expense", v: money(a.avgExpense) },
    { k: "Biggest expense", v: money(a.biggestExpense) },
    { k: "Avg. / active day", v: money(a.avgPerDay) },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.k} className="gap-0 p-3.5">
            <div className="text-xs font-medium text-muted-foreground">{s.k}</div>
            <div className={cn("mt-1.5 font-mono text-lg font-semibold tracking-tight sm:text-xl", s.tone)}>{s.v}</div>
            {s.delta != null && (
              <div className={cn("mt-1 text-[11px] font-medium", s.deltaGood ? "text-positive" : "text-negative")}>
                {s.delta >= 0 ? "▲" : "▼"} {Math.abs(s.delta)}% vs last
              </div>
            )}
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BudgetsCard budgets={budgets} categories={categories} />
        <NetWorthChart series={netWorth} />
      </div>

      <TrendChart transactions={transactions} rangeType={rangeType} start={rangeStart} end={rangeEnd} />

      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownCard title="Expenses by category" items={a.expenseByCat} total={a.totalExpense} money={money} />
        <BreakdownCard title="Income by source" items={a.incomeByCat} total={a.totalIncome} money={money} />
      </div>

      <BreakdownCard title="Spending by account" items={a.byAccount} total={a.totalExpense} money={money} />

      <div className="grid gap-4 lg:grid-cols-2">
        <ListCard title="Top merchants" rows={a.topMerchants.map((m) => ({ key: m.name, name: m.name, meta: `${m.count}×`, value: money(m.value), color: m.color, icon: m.icon }))} />
        <ListCard
          title="Largest transactions"
          rows={a.largest.map((t) => ({
            key: t.id,
            name: t.note || t.category?.name || "Transaction",
            meta: t.account?.name ?? "—",
            value: `${t.type === "income" ? "+" : "−"}${money(t.amount)}`,
            valueClass: t.type === "income" ? "text-positive" : "text-negative",
            color: t.category?.color ?? "#94a3b8",
            icon: t.category?.icon ?? "circle-help",
          }))}
        />
      </div>
    </div>
  );
}

function BreakdownCard({ title, items, total, money }: { title: string; items: Item[]; total: number; money: (n: number) => string }) {
  return (
    <Card className="gap-3">
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
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

function ListCard({ title, rows }: { title: string; rows: { key: string; name: string; meta: string; value: string; valueClass?: string; color: string; icon: string }[] }) {
  return (
    <Card className="gap-3">
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nothing here yet.</p>
        ) : (
          <ul className="space-y-2.5">
            {rows.map((r) => (
              <li key={r.key} className="flex items-center gap-2.5 text-sm">
                <span className="grid size-7 shrink-0 place-items-center rounded-md" style={{ backgroundColor: `${r.color}22`, color: r.color }}>
                  <Icon name={r.icon} size={14} />
                </span>
                <span className="flex-1 truncate">{r.name}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{r.meta}</span>
                <span className={cn("w-24 text-right font-mono text-xs font-medium", r.valueClass)}>{r.value}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
