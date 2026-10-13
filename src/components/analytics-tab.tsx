"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  BarChart3,
  PieChart,
  CalendarDays,
  Sparkles,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { TrendChart } from "@/components/trend-chart";
import { NetWorthChart } from "@/components/net-worth-chart";
import { BudgetsCard } from "@/components/budgets-card";
import { Icon } from "@/components/icon";
import { useFormat } from "@/components/settings-provider";
import { TrendsSection } from "@/components/insights/trends-section";
import { BudgetsSection } from "@/components/insights/budgets-section";
import { CommitmentsSection } from "@/components/insights/commitments-section";
import { PatternsSection } from "@/components/insights/patterns-section";
import { colorFor, getColorCombo } from "@/lib/colors";
import { cn } from "@/lib/utils";
import type { AnalyticsData } from "@/lib/analytics";
import type { RangeType } from "@/lib/dates";
import type {
  AccountDTO,
  BudgetProgressDTO,
  CategoryDTO,
  NetWorthPoint,
  RecurringDTO,
  TransactionDTO,
} from "@/lib/queries";

const VIEWS = [
  { key: "summary", label: "Summary", icon: BarChart3 },
  { key: "trends", label: "Year trends", icon: TrendingUp },
  { key: "budgets", label: "Category budgets", icon: PieChart },
  { key: "commitments", label: "Commitments", icon: CalendarDays },
  { key: "patterns", label: "Spending Patterns", icon: Sparkles },
] as const;
type View = (typeof VIEWS)[number]["key"];

type Item = {
  id?: string | null;
  name: string;
  value: number;
  count: number;
  color: string;
  icon: string;
  type?: "category" | "account";
};
export type Comparison = { prevIncome: number; prevExpense: number } | null;

function aggregate(list: TransactionDTO[], by: "category" | "account"): Item[] {
  const map = new Map<string, Item>();
  for (const t of list) {
    const ref = by === "category" ? t.category : t.account;
    const id = by === "category" ? t.categoryId : t.accountId;
    const name = ref?.name ?? (by === "category" ? "Uncategorised" : "—");
    const item = map.get(name) ?? {
      id,
      name,
      value: 0,
      count: 0,
      color: ref?.color ?? colorFor(name),
      icon: ref?.icon ?? (by === "category" ? "circle-help" : "wallet"),
      type: by,
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

type AnalyticsTabProps = {
  transactions: TransactionDTO[];
  rangeType: RangeType;
  rangeStart: string;
  rangeEnd: string;
  rangeLabel: string;
  budgets: BudgetProgressDTO[];
  categories: CategoryDTO[];
  accounts: AccountDTO[];
  recurring: RecurringDTO[];
  netWorth: NetWorthPoint[];
  comparison: Comparison;
  analytics: AnalyticsData;
  canEdit: boolean;
  showAuthors: boolean;
};

export function AnalyticsTab(props: AnalyticsTabProps) {
  const [view, setView] = useState<View>("summary");
  const {
    analytics,
    transactions,
    recurring,
    accounts,
    categories,
    budgets,
    rangeLabel,
    showAuthors,
    canEdit,
  } = props;

  return (
    <div className="space-y-4">
      {/* Horizontally scrollable segmented nav bar with Precision Glass Pillbox */}
      <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        <div className="inline-flex gap-1 rounded-lg bg-muted/50 p-1">
          {VIEWS.map((v) => {
            const IconCmp = v.icon;
            const isActive = view === v.key;
            return (
              <button
                key={v.key}
                type="button"
                onClick={() => setView(v.key)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold whitespace-nowrap transition-all duration-200",
                  isActive
                    ? "bg-foreground text-background shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                )}
              >
                <IconCmp className="size-3.5" />
                <span>{v.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {view === "summary" && <SummaryView {...props} />}
      {view === "trends" && (
        <TrendsSection
          data={analytics}
          transactions={transactions}
          rangeLabel={rangeLabel}
          rangeStart={props.rangeStart}
          rangeEnd={props.rangeEnd}
        />
      )}
      {view === "budgets" && (
        <BudgetsSection
          data={analytics}
          budgets={budgets}
          categories={categories}
          canEdit={canEdit}
        />
      )}
      {view === "commitments" && (
        <CommitmentsSection
          data={analytics}
          recurring={recurring}
          accounts={accounts}
          categories={categories}
          canEdit={canEdit}
        />
      )}
      {view === "patterns" && (
        <PatternsSection
          data={analytics}
          transactions={transactions}
          recurring={recurring}
          rangeLabel={rangeLabel}
          showAuthors={showAuthors}
        />
      )}
    </div>
  );
}

function SummaryView({
  transactions,
  rangeType,
  rangeStart,
  rangeEnd,
  budgets,
  categories,
  netWorth,
  comparison,
  canEdit,
  rangeLabel,
}: AnalyticsTabProps) {
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
      const m = merchants.get(key) ?? {
        name: note,
        value: 0,
        count: 0,
        color: t.category?.color ?? "#64748b",
        icon: t.category?.icon ?? "circle-help",
      };
      m.value += t.amount;
      m.count += 1;
      merchants.set(key, m);
    }

    return {
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
      topMerchants: [...merchants.values()]
        .sort((x, y) => y.value - x.value)
        .slice(0, 6),
      largest: [...transactions]
        .sort((x, y) => y.amount - x.amount)
        .slice(0, 6),
    };
  }, [transactions]);

  if (!transactions.length) {
    return (
      <div className="space-y-6">
        <NetWorthChart series={netWorth} />
        <div className="rounded-2xl border border-border/70 bg-card p-12 text-center text-sm text-muted-foreground shadow-xs">
          No transactions in this period — widen the range, or try Trends and Patterns above, which look back across the entire year.
        </div>
      </div>
    );
  }

  const incomeDelta = comparison
    ? pctChange(a.totalIncome, comparison.prevIncome)
    : null;
  const expenseDelta = comparison
    ? pctChange(a.totalExpense, comparison.prevExpense)
    : null;

  const stats = [
    {
      k: "Total Inflow",
      v: money(a.totalIncome),
      tone: "text-positive",
      delta: incomeDelta,
      deltaGood: (incomeDelta ?? 0) >= 0,
    },
    {
      k: "Total Outflow",
      v: money(a.totalExpense),
      tone: "text-negative",
      delta: expenseDelta,
      deltaGood: (expenseDelta ?? 0) <= 0,
    },
    {
      k: "Net Retained",
      v: `${a.net < 0 ? "−" : "+"}${money(a.net)}`,
      tone: a.net < 0 ? "text-negative" : "text-positive",
    },
    {
      k: "Savings Efficiency",
      v: `${a.savingsRate}%`,
      tone: a.savingsRate >= 20 ? "text-positive" : "text-foreground",
    },
    { k: "Logged Transactions", v: String(transactions.length) },
    { k: "Average Ticket Size", v: money(a.avgExpense) },
    { k: "Largest Outflow", v: money(a.biggestExpense) },
    { k: "Daily Burn Rate", v: money(a.avgPerDay) },
  ];

  return (
    <div className="space-y-6">
      {/* Executive Financial Statement Card */}
      <section className="dashboard-panel p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground ">
                {rangeLabel}
              </span>
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs font-medium",
                  a.net >= 0
                    ? "bg-positive/10 text-positive"
                    : "bg-negative/10 text-negative",
                )}
              >
                {a.net >= 0 ? "Income above spending" : "Spending above income"}
              </span>
            </div>
            <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              {a.net < 0
                ? `Spending exceeded income by ${money(Math.abs(a.net))}`
                : `${money(a.net)} left after expenses`}
            </h2>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
              {a.totalIncome > 0
                ? `${a.savingsRate}% of income retained in this period.`
                : "Add income to see the share left after expenses."}{" "}
              Transfers between accounts are excluded.
            </p>
          </div>
        </div>
      </section>

      {/* Primary 4-Stat Metric Lattice */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.slice(0, 4).map((s) => (
          <div key={s.k} className="dashboard-panel p-4">
            <div className="truncate text-xs font-semibold text-muted-foreground ">
              {s.k}
            </div>
            <div
              className={cn(
                "amount mt-2 truncate text-xl font-bold tracking-tight sm:text-2xl",
                s.tone,
              )}
            >
              {s.v}
            </div>
            {s.delta != null && (
              <div
                className={cn(
                  "mt-2 inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 text-xs font-medium",
                  s.deltaGood
                    ? "bg-positive/10 text-positive"
                    : "bg-negative/10 text-negative",
                )}
              >
                {s.delta >= 0 ? "▲" : "▼"} {Math.abs(s.delta)}% vs prior
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Expandable Advanced Metrics */}
      <details className="group rounded-2xl border border-border/80 bg-card px-5 py-3 shadow-2xs">
        <summary className="flex cursor-pointer items-center justify-between text-xs font-semibold text-foreground">
          <span>Extended Burn Rate & Transaction Metrics</span>
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <dl className="grid grid-cols-2 gap-4 pt-4 pb-2 sm:grid-cols-4 border-t border-border/50 mt-3">
          {stats.slice(4).map((s) => (
            <div key={s.k}>
              <dt className="text-[11px] font-medium text-muted-foreground">{s.k}</dt>
              <dd className="mt-1 text-sm font-bold text-foreground">{s.v}</dd>
            </div>
          ))}
        </dl>
      </details>

      {/* Charts Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        <BudgetsCard
          budgets={budgets}
          categories={categories}
          canEdit={canEdit}
        />
        <NetWorthChart series={netWorth} />
      </div>

      <TrendChart
        transactions={transactions}
        rangeType={rangeType}
        start={rangeStart}
        end={rangeEnd}
      />

      {/* Category Breakdowns */}
      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownCard
          title="Expenses by Category"
          subtitle="All recorded outflow categorized"
          items={a.expenseByCat}
          total={a.totalExpense}
          money={money}
        />
        <BreakdownCard
          title="Income by Source"
          subtitle="All inflow and earnings categorized"
          items={a.incomeByCat}
          total={a.totalIncome}
          money={money}
        />
      </div>

      <BreakdownCard
        title="Spending Distribution by Account"
        subtitle="Where cash outflow originated"
        items={a.byAccount}
        total={a.totalExpense}
        money={money}
      />

      {/* Ranked Lists */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ListCard
          title="Top Spending Merchants & Notes"
          subtitle="Highest outflow destinations"
          rows={a.topMerchants.map((m, idx) => ({
            key: m.name,
            rank: idx + 1,
            name: m.name,
            meta: `${m.count}× transaction${m.count === 1 ? "" : "s"}`,
            value: money(m.value),
            color: m.color,
            icon: m.icon,
          }))}
        />
        <ListCard
          title="Largest Single Transactions"
          subtitle="Top outflow and inflow occurrences"
          rows={a.largest.map((t, idx) => ({
            key: t.id,
            rank: idx + 1,
            name: t.note || t.category?.name || "Transaction",
            meta: `${t.account?.name ?? "Account"} · ${t.date}`,
            value: `${t.type === "income" ? "+" : "−"}${money(t.amount)}`,
            valueClass:
              t.type === "income" ? "text-positive" : "text-negative",
            color: t.category?.color ?? "#64748b",
            icon: t.category?.icon ?? "circle-help",
          }))}
        />
      </div>
    </div>
  );
}

function BreakdownCard({
  title,
  subtitle,
  items,
  total,
  money,
}: {
  title: string;
  subtitle?: string;
  items: Item[];
  total: number;
  money: (n: number) => string;
}) {
  return (
    <div className="dashboard-panel p-4 sm:p-5 space-y-4">
      <div className="border-b border-border/60 pb-3">
        <h3 className="text-sm font-bold tracking-tight text-foreground">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <div>
        {items.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            No entries recorded for this view.
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((it, idx) => {
              const pct = total ? Math.round((it.value / total) * 100) : 0;
              const combo = getColorCombo(it.color);
              const href = it.id
                ? it.type === "account"
                  ? `/accounts/${it.id}`
                  : `/categories/${it.id}`
                : null;

              const content = (
                <div className="flex items-center gap-2.5 text-xs">
                  <span className="text-[10px] font-bold text-muted-foreground/70 w-4 text-center">
                    #{idx + 1}
                  </span>
                  <span
                    className="grid size-7 shrink-0 place-items-center rounded-lg border transition-transform group-hover:scale-105"
                    style={{
                      backgroundColor: combo.background,
                      borderColor: combo.border,
                      color: combo.text,
                    }}
                  >
                    <Icon name={it.icon} size={14} />
                  </span>
                  <span className="flex-1 truncate font-semibold text-foreground group-hover:text-brand transition-colors">
                    {it.name}
                  </span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {pct}%
                  </span>
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {it.count}×
                  </span>
                  <span className="w-24 text-right font-bold text-foreground font-mono">
                    {money(it.value)}
                  </span>
                  {href && (
                    <ChevronRight className="size-3 text-muted-foreground opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                  )}
                </div>
              );

              return (
                <li key={it.name} className="group space-y-1.5">
                  {href ? (
                    <Link
                      href={href}
                      className="block rounded-lg p-1 -m-1 transition-colors hover:bg-muted/40"
                    >
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted/80">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: it.color }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function ListCard({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle?: string;
  rows: {
    key: string;
    rank: number;
    name: string;
    meta: string;
    value: string;
    valueClass?: string;
    color: string;
    icon: string;
  }[];
}) {
  return (
    <div className="dashboard-panel p-4 sm:p-5 space-y-4">
      <div className="border-b border-border/60 pb-3">
        <h3 className="text-sm font-bold tracking-tight text-foreground">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <div>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            No items recorded for this view.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {rows.map((r) => {
              const combo = getColorCombo(r.color);
              const rankColor =
                r.rank === 1
                  ? "bg-amber-500/15 text-amber-500 ring-amber-500/30"
                  : r.rank === 2
                    ? "bg-slate-400/15 text-slate-400 ring-slate-400/30"
                    : r.rank === 3
                      ? "bg-amber-700/15 text-amber-600 ring-amber-700/30"
                      : "bg-muted text-muted-foreground ring-border";

              return (
                <li
                  key={r.key}
                  className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-card/60 p-2.5 text-xs transition-colors hover:bg-muted/40 hover:border-border"
                >
                  <span
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ring-1",
                      rankColor,
                    )}
                  >
                    {r.rank}
                  </span>
                  <span
                    className="grid size-7 shrink-0 place-items-center rounded-lg border shadow-2xs"
                    style={{
                      backgroundColor: combo.background,
                      borderColor: combo.border,
                      color: combo.text,
                    }}
                  >
                    <Icon name={r.icon} size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-foreground">
                      {r.name}
                    </span>
                    <span className="block text-[10px] text-muted-foreground truncate">
                      {r.meta}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "amount shrink-0 text-right font-bold text-xs font-mono",
                      r.valueClass,
                    )}
                  >
                    {r.value}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
