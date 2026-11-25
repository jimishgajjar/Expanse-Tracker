"use client";

import { useMemo } from "react";
import { ArrowDownLeft, ArrowUpRight, Scale, TrendingDown, TrendingUp } from "lucide-react";
import { useFormat } from "./settings-provider";
import { cn } from "@/lib/utils";
import { Guilloche } from "./guilloche";

type Entry = { type: string; amount: number; date: string };
const BINS = 24;
const day = (iso: string) => Date.parse(iso.slice(0, 10) + "T00:00:00Z");

/** Split the period into equal slices and total income and spending in each. */
function series(entries: Entry[], start?: string, end?: string) {
  const dated = entries.filter((e) => /^\d{4}-\d{2}-\d{2}/.test(e.date));
  if (!dated.length) return null;
  const times = dated.map((e) => day(e.date));
  const valid = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? day(s) : NaN);
  let from = valid(start), to = valid(end);
  if (!Number.isFinite(from) || from < Date.UTC(1990, 0, 1)) from = Math.min(...times);
  // Stop the line at today (or the last entry) so a running period has no flat tail.
  const lastEntry = Math.max(...times) + 86400000;
  to = Number.isFinite(to) ? Math.min(to, Math.max(Date.now() + 86400000, lastEntry)) : lastEntry;
  const span = Math.max(to - from, 86400000);
  const income = Array<number>(BINS).fill(0), expense = Array<number>(BINS).fill(0);
  for (const e of dated) {
    const i = Math.min(BINS - 1, Math.max(0, Math.floor(((day(e.date) - from) / span) * BINS)));
    (e.type === "income" ? income : expense)[i] += e.amount;
  }
  let running = 0;
  const cumulative = income.map((v, i) => (running += v - expense[i]));
  return { income, expense, cumulative };
}

export function Sparkline({ values }: { values: number[] }) {
  const min = Math.min(0, ...values), max = Math.max(0, ...values);
  const range = max - min || 1;
  const points = values.map((v, i) => `${(i / (values.length - 1)) * 100},${30 - ((v - min) / range) * 28}`);
  const zero = 30 - ((0 - min) / range) * 28;
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="h-14 w-full" aria-hidden>
      <line x1="0" x2="100" y1={zero} y2={zero} stroke="currentColor" strokeOpacity="0.25" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
      <polygon points={`0,${zero} ${points.join(" ")} 100,${zero}`} fill="currentColor" fillOpacity="0.14" />
      <polyline points={points.join(" ")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function MiniBars({ values, tone }: { values: number[]; tone: (v: number) => string }) {
  // Twelve bars read better than twenty-four at tile width.
  const merged = Array.from({ length: values.length / 2 }, (_, i) => values[i * 2] + values[i * 2 + 1]);
  const max = Math.max(1, ...merged.map(Math.abs));
  return (
    <div className="flex h-8 items-end gap-[3px]" aria-hidden>
      {merged.map((v, i) => (
        <span key={i} className={cn("flex-1 rounded-sm", v === 0 ? "bg-border" : tone(v))} style={{ height: v === 0 ? 2 : `${Math.max(8, (Math.abs(v) / max) * 100)}%` }} />
      ))}
    </div>
  );
}

export function SummaryCards({
  totalBalance,
  income,
  expense,
  net,
  rangeLabel,
  accountsCount,
  comparison,
  decisionView = false,
  transactions = [],
  rangeStart,
  rangeEnd,
}: {
  totalBalance: number;
  income: number;
  expense: number;
  net: number;
  rangeLabel: string;
  accountsCount: number;
  decisionView?: boolean;
  comparison?: { prevIncome: number; prevExpense: number } | null;
  transactions?: Entry[];
  rangeStart?: string;
  rangeEnd?: string;
}) {
  const { money, signedMoney, balanceMoney } = useFormat();
  const data = useMemo(() => series(transactions, rangeStart, rangeEnd), [transactions, rangeStart, rangeEnd]);

  const delta = (current: number, previous?: number) =>
    previous ? Math.round(((current - previous) / Math.abs(previous)) * 100) : null;
  const incomeDelta = delta(income, comparison?.prevIncome);
  const expenseDelta = delta(expense, comparison?.prevExpense);
  const prevNet = comparison ? comparison.prevIncome - comparison.prevExpense : undefined;
  const netDelta = delta(net, prevNet);
  const retained = income > 0 ? Math.round((net / income) * 100) : null;

  const tiles = [
    { label: "Income", value: money(income), icon: ArrowDownLeft, tone: "text-positive", chip: "bg-positive/10 text-positive",
      change: incomeDelta, good: (d: number) => d >= 0, bars: data?.income, bar: () => "bg-positive/70" },
    { label: "Expenses", value: money(expense), icon: ArrowUpRight, tone: "text-foreground", chip: "bg-negative/10 text-negative",
      change: expenseDelta, good: (d: number) => d <= 0, bars: data?.expense, bar: () => "bg-negative/60" },
    { label: "Net cash flow", value: signedMoney(net), icon: Scale, tone: net < 0 ? "text-negative" : "text-positive",
      chip: net < 0 ? "bg-negative/10 text-negative" : "bg-positive/10 text-positive",
      change: netDelta, good: (d: number) => d >= 0, bars: data ? data.income.map((v, i) => v - data.expense[i]) : undefined,
      bar: (v: number) => (v < 0 ? "bg-negative/60" : "bg-positive/70") },
  ];

  return (
    <section aria-label={decisionView ? "Current position" : "Financial summary"} className="grid gap-3 xl:grid-cols-[minmax(320px,1fr)_minmax(0,2fr)]">
      {/* The one committed moment on this screen: the household's position. */}
      <div className="relative isolate flex min-w-0 flex-col justify-between overflow-hidden rounded-xl bg-brand-deep p-5 text-brand-deep-foreground pt-12 sm:p-6 sm:pt-14">
        <Guilloche className="absolute inset-x-0 top-0 -z-10 h-11 w-full text-brass opacity-60 [mask-image:linear-gradient(to_bottom,black_40%,transparent)]" />
        <div>
          <p className="text-sm font-medium opacity-85">{decisionView ? "Current position" : "Total balance"}</p>
          <h2 className="display-figure mt-2 break-words text-[clamp(2.2rem,3.4vw,3rem)]">
            {balanceMoney(totalBalance)}
          </h2>
          <p className="mt-2 text-xs opacity-80">
            Across {accountsCount} {accountsCount === 1 ? "account" : "accounts"} · all dates
          </p>
        </div>
        <div className="mt-5">
          {data ? <Sparkline values={data.cumulative} /> : <div className="h-14" />}
          <p className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
            <span className="opacity-80">Net cash flow · {rangeLabel}</span>
            <span className="amount font-semibold">{signedMoney(net)}</span>
          </p>
        </div>
      </div>

      <div className="grid min-w-0 gap-3">
        <dl className="grid gap-3 sm:grid-cols-3">
          {tiles.map(({ label, value, icon: TileIcon, tone, chip, change, good, bars, bar }) => (
            <div key={label} className="dashboard-panel flex min-w-0 flex-col justify-between gap-3 p-4">
              <div>
                <dt className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
                  <span>{label}</span>
                  <span className={cn("grid size-6 place-items-center rounded-md", chip)}><TileIcon className="size-3.5" aria-hidden /></span>
                </dt>
                <dd className={cn("amount mt-1.5 break-words text-xl font-bold tracking-tight", tone)}>{value}</dd>
                <dd className="mt-1 text-[11px] text-muted-foreground">
                  {change === null ? "No prior period to compare" : (
                    <span className={cn("inline-flex items-center gap-1 font-medium", good(change) ? "text-positive" : "text-negative")}>
                      {change >= 0 ? <TrendingUp className="size-3" aria-hidden /> : <TrendingDown className="size-3" aria-hidden />}
                      {change > 0 ? "+" : ""}{change}%
                      <span className="font-normal text-muted-foreground">vs prior period</span>
                    </span>
                  )}
                </dd>
              </div>
              {bars && <MiniBars values={bars} tone={bar} />}
            </div>
          ))}
        </dl>
        <div className="dashboard-panel flex flex-wrap items-center gap-x-5 gap-y-2 p-4">
          <div className="min-w-32">
            <p className="text-xs font-medium text-muted-foreground">Savings rate</p>
            <p className={cn("amount text-xl font-bold tracking-tight", retained !== null && retained < 0 ? "text-negative" : "text-foreground")}>
              {retained === null ? "—" : `${retained}%`}
            </p>
          </div>
          <div className="min-w-40 flex-1">
            <div className="h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={retained === null ? "No income in this period" : `${retained}% of income kept`}>
              <div className={cn("h-full rounded-full", retained !== null && retained < 0 ? "bg-negative" : "bg-brand")} style={{ width: `${Math.max(0, Math.min(100, Math.abs(retained ?? 0)))}%` }} />
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {retained === null ? "No income recorded in this period."
                : retained >= 0 ? <>Kept <span className="amount font-medium text-foreground">{money(net)}</span> of <span className="amount">{money(income)}</span> earned. Transfers between your accounts are not counted.</>
                : <>Spent <span className="amount font-medium text-negative">{money(-net)}</span> more than you earned. Transfers between your accounts are not counted.</>}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
