"use client";

import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFormat } from "@/components/settings-provider";
import { cn } from "@/lib/utils";
import { Caveat, DeltaPill, Empty, Hero, Sparkline, Tile, pctChange } from "@/components/insights/parts";
import type { AnalyticsData } from "@/lib/analytics";
import type { TransactionDTO } from "@/lib/queries";

const monthLabel = (key: string) => format(parseISO(`${key}-01`), "MMM");
const monthLong = (key: string) => format(parseISO(`${key}-01`), "MMMM yyyy");

/** How many categories get their own colour in the mix chart before the rest
 *  collapse into "Other" — beyond ~6 bands the stack stops being readable. */
const MIX_BANDS = 6;

export function TrendsSection({
  data,
  transactions,
  rangeLabel,
  rangeStart,
  rangeEnd,
}: {
  data: AnalyticsData;
  transactions: TransactionDTO[];
  rangeLabel: string;
  rangeStart: string;
  rangeEnd: string;
}) {
  const { money, balanceMoney } = useFormat();

  // Running balance across the selected range, anchored to what the workspace
  // was actually worth the day the range opened.
  const balanceLine = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const t of transactions) {
      byDate.set(t.date, (byDate.get(t.date) ?? 0) + (t.type === "income" ? t.amount : -t.amount));
    }
    const points: { date: string; value: number }[] = [];
    let running = data.openingBalance;
    for (const date of [...byDate.keys()].sort()) {
      running += byDate.get(date) ?? 0;
      points.push({ date, value: running });
    }
    return { points, closing: running, change: running - data.openingBalance };
  }, [transactions, data.openingBalance]);

  const monthly = data.monthly;
  const activeMonths = monthly.filter((m) => m.income > 0 || m.expense > 0);
  const avgNet = activeMonths.length ? activeMonths.reduce((s, m) => s + m.net, 0) / activeMonths.length : 0;

  const expenseDeltas = data.categoryDeltas.filter((c) => c.kind === "expense");
  const incomeDeltas = data.categoryDeltas.filter((c) => c.kind === "income");
  const sparkFor = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const s of data.categoryMonthly.series) m.set(s.categoryId ?? "none", s.values);
    return m;
  }, [data.categoryMonthly]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Hero
          accent
          label={`Balance change · ${rangeLabel}`}
          value={`${balanceLine.change < 0 ? "−" : "+"}${money(balanceLine.change)}`}
          tone={balanceLine.change < 0 ? "text-negative" : "text-positive"}
          note={
            <>
              {balanceMoney(data.openingBalance)} at the start → <span className="font-medium text-foreground">{balanceMoney(balanceLine.closing)}</span> at the end
            </>
          }
        />
        <Hero
          label="Average monthly net"
          value={`${avgNet < 0 ? "−" : "+"}${money(avgNet)}`}
          tone={avgNet < 0 ? "text-negative" : "text-positive"}
          note={
            activeMonths.length
              ? `Across ${activeMonths.length} month${activeMonths.length === 1 ? "" : "s"} with activity in the last year`
              : "No activity in the last year"
          }
        />
      </div>

      <RunningBalance points={balanceLine.points} opening={data.openingBalance} start={rangeStart} end={rangeEnd} />

      <MonthlyRhythm monthly={monthly} />

      <Card className="gap-3">
        <CardHeader>
          <CardTitle>Category movement</CardTitle>
          <span className="ml-auto text-xs text-muted-foreground">
            {data.hasPrevious ? "vs previous period" : "no comparable period"}
          </span>
        </CardHeader>
        <CardContent>
          {expenseDeltas.length === 0 ? (
            <Empty>No spending in this period.</Empty>
          ) : (
            <MovementTable rows={expenseDeltas} sparkFor={sparkFor} money={money} hasPrev={data.hasPrevious} goodWhen="down" />
          )}
          {incomeDeltas.length > 0 && (
            <>
              <div className="mt-5 mb-2 text-xs font-medium text-muted-foreground">Income</div>
              <MovementTable rows={incomeDeltas} sparkFor={sparkFor} money={money} hasPrev={data.hasPrevious} goodWhen="up" />
            </>
          )}
          <Caveat>
            Sparklines show the last 12 months of spend for that category, independent of the period selected above.
          </Caveat>
        </CardContent>
      </Card>

      <CategoryMix data={data.categoryMonthly} money={money} />
    </div>
  );
}

/** Net position per month as bars above/below a zero line — the shape of the
 *  year at a glance, which paired income/expense bars bury. */
function MonthlyRhythm({ monthly }: { monthly: AnalyticsData["monthly"] }) {
  const { money } = useFormat();
  const peak = Math.max(1, ...monthly.map((m) => Math.abs(m.net)));
  const best = monthly.reduce((a, b) => (b.net > a.net ? b : a), monthly[0]);
  const worst = monthly.reduce((a, b) => (b.net < a.net ? b : a), monthly[0]);

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>Monthly rhythm <span className="font-normal text-muted-foreground">· net, last 12 months</span></CardTitle>
        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-positive" /> Surplus</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-negative" /> Deficit</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex h-[160px] items-stretch gap-1">
          {monthly.map((m) => {
            const h = (Math.abs(m.net) / peak) * 50; // % of the half-height each side of the axis
            const positive = m.net >= 0;
            return (
              <div
                key={m.key}
                className="group flex min-w-0 flex-1 flex-col"
                title={`${monthLong(m.key)} · in ${money(m.income)} · out ${money(m.expense)} · net ${m.net < 0 ? "−" : "+"}${money(m.net)}`}
              >
                <div className="flex flex-1 items-end justify-center">
                  {positive && (
                    <div
                      className={cn("w-full max-w-[26px] rounded-t-[3px] bg-positive transition-opacity group-hover:opacity-75", m.net > 0 && "min-h-[2px]")}
                      style={{ height: `${h * 2}%` }}
                    />
                  )}
                </div>
                <div aria-hidden className="border-t border-border" />
                <div className="flex flex-1 items-start justify-center">
                  {!positive && (
                    <div
                      className="w-full max-w-[26px] min-h-[2px] rounded-b-[3px] bg-negative transition-opacity group-hover:opacity-75"
                      style={{ height: `${h * 2}%` }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex gap-1">
          {monthly.map((m) => (
            <span key={m.key} className="min-w-0 flex-1 truncate text-center text-[10px] leading-3 text-muted-foreground">
              {monthLabel(m.key)}
            </span>
          ))}
        </div>
        {best && worst && best.key !== worst.key && (
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
            <span>Best · <span className="font-medium text-positive">{monthLong(best.key)}</span> +{money(best.net)}</span>
            <span>Worst · <span className="font-medium text-negative">{monthLong(worst.key)}</span> {worst.net < 0 ? "−" : "+"}{money(worst.net)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RunningBalance({
  points,
  opening,
  start,
  end,
}: {
  points: { date: string; value: number }[];
  opening: number;
  start: string;
  end: string;
}) {
  const { money, balanceMoney } = useFormat();
  // One point can't describe a trajectory; two is the minimum for a line.
  const series = points.length ? [{ date: start, value: opening }, ...points] : [];

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>Running balance</CardTitle>
        {series.length > 0 && (
          <span className="amount ml-auto text-sm font-semibold tabular-nums">{balanceMoney(series[series.length - 1].value)}</span>
        )}
      </CardHeader>
      <CardContent>
        {series.length < 2 ? (
          <Empty>Not enough activity in this period to plot a balance line.</Empty>
        ) : (
          (() => {
            const W = 600;
            const H = 160;
            const pad = 6;
            const values = series.map((p) => p.value);
            const min = Math.min(...values);
            const max = Math.max(...values);
            const span = max - min || 1;
            const x = (i: number) => pad + (i / (series.length - 1)) * (W - 2 * pad);
            const y = (v: number) => H - pad - ((v - min) / span) * (H - 2 * pad);
            const line = series.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)},${y(p.value).toFixed(2)}`).join(" ");
            const area = `${line} L ${x(series.length - 1).toFixed(2)},${H - pad} L ${x(0).toFixed(2)},${H - pad} Z`;
            const ends = series[series.length - 1].value >= series[0].value;
            const stroke = ends ? "var(--positive)" : "var(--negative)";
            const zeroInView = min < 0 && max > 0;
            return (
              <>
                <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full" preserveAspectRatio="none" role="img" aria-label="Running balance over the selected period">
                  <defs>
                    <linearGradient id="rb-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
                      <stop offset="100%" stopColor={stroke} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {zeroInView && (
                    <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="var(--border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                  )}
                  <path d={area} fill="url(#rb-grad)" />
                  <path d={line} fill="none" stroke={stroke} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                </svg>
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                  <span>{format(parseISO(start), "d MMM")} · {money(opening)}</span>
                  <span>{format(parseISO(end), "d MMM yyyy")}</span>
                </div>
              </>
            );
          })()
        )}
      </CardContent>
    </Card>
  );
}

function MovementTable({
  rows,
  sparkFor,
  money,
  hasPrev,
  goodWhen,
}: {
  rows: AnalyticsData["categoryDeltas"];
  sparkFor: Map<string, number[]>;
  money: (n: number) => string;
  hasPrev: boolean;
  goodWhen: "up" | "down";
}) {
  const total = rows.reduce((s, r) => s + r.current, 0);
  return (
    <ul className="divide-y divide-border">
      {rows.map((r) => {
        const delta = hasPrev ? pctChange(r.current, r.previous) : null;
        const spark = sparkFor.get(r.categoryId ?? "none");
        return (
          <li key={`${r.categoryId ?? "none"}-${r.kind}`} className="flex items-center gap-3 py-2.5">
            <Tile color={r.color} icon={r.icon} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">{r.name}</div>
              <div className="text-[11px] text-muted-foreground">
                {r.count}× · {total ? Math.round((r.current / total) * 100) : 0}% of total
              </div>
            </div>
            {spark && spark.some((v) => v > 0) && (
              <div className="hidden w-20 shrink-0 sm:block">
                <Sparkline values={spark} color={r.color} />
              </div>
            )}
            <div className="w-28 shrink-0 text-right">
              <div className="amount text-sm font-medium tabular-nums">{money(r.current)}</div>
              {hasPrev && (
                <div>
                  {r.previous > 0 ? (
                    <DeltaPill pct={delta} goodWhen={goodWhen} />
                  ) : (
                    <span className="text-[11px] text-muted-foreground">new</span>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Stacked share of spend per month — shows the mix shifting, not just the total. */
function CategoryMix({ data, money }: { data: AnalyticsData["categoryMonthly"]; money: (n: number) => string }) {
  const bands = useMemo(() => {
    const top = data.series.slice(0, MIX_BANDS);
    const rest = data.series.slice(MIX_BANDS);
    const out = top.map((s) => ({ name: s.name, color: s.color, values: s.values }));
    if (rest.length) {
      out.push({
        name: `Other (${rest.length})`,
        color: "#9b9a97",
        values: data.months.map((_, i) => rest.reduce((s, r) => s + r.values[i], 0)),
      });
    }
    return out;
  }, [data]);

  const monthTotals = data.months.map((_, i) => bands.reduce((s, b) => s + b.values[i], 0));
  const anySpend = monthTotals.some((t) => t > 0);

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>Spending mix <span className="font-normal text-muted-foreground">· share per month</span></CardTitle>
      </CardHeader>
      <CardContent>
        {!anySpend ? (
          <Empty>No spending recorded in the last 12 months.</Empty>
        ) : (
          <>
            <div className="flex h-[150px] items-end gap-1">
              {data.months.map((m, i) => {
                const total = monthTotals[i];
                return (
                  <div key={m} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${monthLong(m)} · ${money(total)}`}>
                    {total === 0 ? (
                      <div className="h-0.5 rounded-full bg-muted" />
                    ) : (
                      <div className="flex h-full flex-col-reverse overflow-hidden rounded-[3px]">
                        {bands.map((b) => {
                          const share = (b.values[i] / total) * 100;
                          if (share <= 0) return null;
                          return <div key={b.name} style={{ height: `${share}%`, backgroundColor: b.color }} />;
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-1 flex gap-1">
              {data.months.map((m) => (
                <span key={m} className="min-w-0 flex-1 truncate text-center text-[10px] leading-3 text-muted-foreground">
                  {monthLabel(m)}
                </span>
              ))}
            </div>
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
              {bands.map((b) => (
                <li key={b.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: b.color }} />
                  <span className="truncate">{b.name}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
