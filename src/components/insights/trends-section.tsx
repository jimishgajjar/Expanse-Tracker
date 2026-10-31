"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFormat } from "@/components/settings-provider";
import { cn } from "@/lib/utils";
import { Caveat, DeltaPill, Empty, Hero, Sparkline, Tile, pctChange } from "@/components/insights/parts";
import type { AnalyticsData } from "@/lib/analytics";
import type { TransactionDTO } from "@/lib/queries";

const monthLabel = (key: string) => {
  try {
    return format(parseISO(`${key}-01`), "MMM");
  } catch {
    return key;
  }
};
const monthLong = (key: string) => {
  try {
    return format(parseISO(`${key}-01`), "MMMM yyyy");
  } catch {
    return key;
  }
};

/** How many categories get their own colour in the mix chart before the rest
 *  collapse into "Other" */
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

  // Running balance across the selected range
  const balanceLine = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const t of transactions) {
      byDate.set(
        t.date,
        (byDate.get(t.date) ?? 0) + (t.type === "income" ? t.amount : -t.amount),
      );
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
  const avgNet = activeMonths.length
    ? activeMonths.reduce((s, m) => s + m.net, 0) / activeMonths.length
    : 0;

  const expenseDeltas = data.categoryDeltas.filter((c) => c.kind === "expense");
  const incomeDeltas = data.categoryDeltas.filter((c) => c.kind === "income");
  const sparkFor = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const s of data.categoryMonthly.series)
      m.set(s.categoryId ?? "none", s.values);
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
              {balanceMoney(data.openingBalance)} at start →{" "}
              <span className="font-medium text-foreground">
                {balanceMoney(balanceLine.closing)}
              </span>{" "}
              at close
            </>
          }
        />
        <Hero
          label="Average monthly net"
          value={`${avgNet < 0 ? "−" : "+"}${money(avgNet)}`}
          tone={avgNet < 0 ? "text-negative" : "text-positive"}
          note={
            activeMonths.length
              ? `Across ${activeMonths.length} active ${activeMonths.length === 1 ? "month" : "months"} over the past year`
              : "No activity in the last year"
          }
        />
      </div>

      <RunningBalance
        points={balanceLine.points}
        opening={data.openingBalance}
        start={rangeStart}
        end={rangeEnd}
      />

      <MonthlyRhythm monthly={monthly} />

      <Card className="gap-3 border border-border/80 bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Category movement</CardTitle>
          <span className="text-xs text-muted-foreground">
            {data.hasPrevious ? "vs previous period" : "no comparable period"}
          </span>
        </CardHeader>
        <CardContent>
          {expenseDeltas.length === 0 ? (
            <Empty>No spending in this period.</Empty>
          ) : (
            <MovementTable
              rows={expenseDeltas}
              sparkFor={sparkFor}
              money={money}
              hasPrev={data.hasPrevious}
              goodWhen="down"
            />
          )}
          {incomeDeltas.length > 0 && (
            <>
              <div className="mt-5 mb-2 text-xs font-semibold text-foreground">
                Income categories
              </div>
              <MovementTable
                rows={incomeDeltas}
                sparkFor={sparkFor}
                money={money}
                hasPrev={data.hasPrevious}
                goodWhen="up"
              />
            </>
          )}
          <Caveat>
            Sparklines represent the last 12 months of spend for that category.
          </Caveat>
        </CardContent>
      </Card>

      <CategoryMix data={data.categoryMonthly} money={money} />
    </div>
  );
}

/** Interactive running balance with crosshair cursor and hover point inspection */
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
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const series = points.length
    ? [{ date: start, value: opening }, ...points]
    : [];

  const activeIndex = hoverIndex ?? (series.length ? series.length - 1 : 0);
  const activePoint = series[activeIndex];

  return (
    <Card className="gap-3 border border-border/80 bg-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Running balance</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Cumulative balance throughout the period
          </p>
        </div>
        {series.length > 0 && (
          <div className="text-right">
            <span className="amount text-base font-bold tabular-nums text-foreground">
              {balanceMoney(activePoint?.value ?? opening)}
            </span>
            {hoverIndex !== null && activePoint && (
              <span className="block text-[10px] text-muted-foreground">
                {format(parseISO(activePoint.date), "MMM d, yyyy")}
              </span>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {series.length < 2 ? (
          <Empty>Not enough activity in this period to plot a balance line.</Empty>
        ) : (
          (() => {
            const W = 600;
            const H = 160;
            const pad = 8;
            const values = series.map((p) => p.value);
            const min = Math.min(...values);
            const max = Math.max(...values);
            const span = max - min || 1;
            const x = (i: number) => pad + (i / (series.length - 1)) * (W - 2 * pad);
            const y = (v: number) => H - pad - ((v - min) / span) * (H - 2 * pad);
            const line = series
              .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)},${y(p.value).toFixed(2)}`)
              .join(" ");
            const area = `${line} L ${x(series.length - 1).toFixed(2)},${H - pad} L ${x(0).toFixed(2)},${H - pad} Z`;
            const ends = series[series.length - 1].value >= series[0].value;
            const stroke = ends ? "var(--positive)" : "var(--negative)";
            const zeroInView = min < 0 && max > 0;

            return (
              <div className="relative">
                <svg
                  viewBox={`0 0 ${W} ${H}`}
                  className="h-40 w-full overflow-visible"
                  preserveAspectRatio="none"
                  role="img"
                  aria-label="Running balance over the selected period"
                  onMouseLeave={() => setHoverIndex(null)}
                >
                  <defs>
                    <linearGradient id="rb-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
                      <stop offset="100%" stopColor={stroke} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {zeroInView && (
                    <line
                      x1="0"
                      x2={W}
                      y1={y(0)}
                      y2={y(0)}
                      stroke="var(--border)"
                      strokeWidth="1"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                  <path d={area} fill="url(#rb-grad)" />
                  <path
                    d={line}
                    fill="none"
                    stroke={stroke}
                    strokeWidth="2.5"
                    vectorEffect="non-scaling-stroke"
                    strokeLinejoin="round"
                  />

                  {/* Vertical Crosshair Line */}
                  {hoverIndex !== null && (
                    <line
                      x1={x(hoverIndex)}
                      x2={x(hoverIndex)}
                      y1={pad}
                      y2={H - pad}
                      stroke="var(--foreground)"
                      strokeOpacity="0.2"
                      strokeDasharray="3 3"
                      strokeWidth="1.5"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}

                  {/* Active Point Circle */}
                  <circle
                    cx={x(activeIndex)}
                    cy={y(activePoint.value)}
                    r={hoverIndex !== null ? 5.5 : 4}
                    fill={stroke}
                    stroke="var(--card)"
                    strokeWidth="2.5"
                    className="transition-transform duration-150 motion-reduce:transition-none"
                  />

                  {/* Interactive touch/hover zones */}
                  {series.map((_, i) => {
                    const colW = W / series.length;
                    const colX = Math.max(0, x(i) - colW / 2);
                    return (
                      <rect
                        key={i}
                        x={colX}
                        y={0}
                        width={colW}
                        height={H}
                        fill="transparent"
                        className="cursor-pointer"
                        onMouseEnter={() => setHoverIndex(i)}
                      />
                    );
                  })}
                </svg>

                <div className="mt-2 flex justify-between text-[11px] font-medium text-muted-foreground">
                  <span>
                    {format(parseISO(start), "d MMM")} · {money(opening)}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60">
                    Hover to track balance
                  </span>
                  <span>{format(parseISO(end), "d MMM yyyy")}</span>
                </div>
              </div>
            );
          })()
        )}
      </CardContent>
    </Card>
  );
}

/** Net position per month as interactive bars with live inspection */
function MonthlyRhythm({ monthly }: { monthly: AnalyticsData["monthly"] }) {
  const { money } = useFormat();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const peak = Math.max(1, ...monthly.map((m) => Math.abs(m.net)));
  const best = monthly.reduce((a, b) => (b.net > a.net ? b : a), monthly[0]);
  const worst = monthly.reduce((a, b) => (b.net < a.net ? b : a), monthly[0]);

  const activeMonth = selectedKey
    ? monthly.find((m) => m.key === selectedKey)
    : null;

  return (
    <Card className="gap-3 border border-border/80 bg-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Monthly rhythm</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Net cash flow across the last 12 months
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 font-semibold text-positive">
            <span className="size-2 rounded-full bg-positive" /> Surplus
          </span>
          <span className="flex items-center gap-1.5 font-semibold text-negative">
            <span className="size-2 rounded-full bg-negative" /> Deficit
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {activeMonth && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs">
            <span className="font-semibold text-foreground">
              {monthLong(activeMonth.key)}
            </span>
            <div className="flex items-center gap-3">
              <span className="text-positive font-medium">
                In: {money(activeMonth.income)}
              </span>
              <span className="text-negative font-medium">
                Out: {money(activeMonth.expense)}
              </span>
              <span
                className={cn(
                  "amount rounded px-1.5 py-0.2 font-bold",
                  activeMonth.net >= 0
                    ? "bg-positive/10 text-positive"
                    : "bg-negative/10 text-negative",
                )}
              >
                Net: {activeMonth.net < 0 ? "−" : "+"}
                {money(activeMonth.net)}
              </span>
            </div>
          </div>
        )}

        <div className="flex h-[160px] items-stretch gap-1">
          {monthly.map((m) => {
            const h = (Math.abs(m.net) / peak) * 50;
            const positive = m.net >= 0;
            const isHovered = selectedKey === m.key;

            return (
              <button
                key={m.key}
                type="button"
                onMouseEnter={() => setSelectedKey(m.key)}
                onFocus={() => setSelectedKey(m.key)}
                onClick={() => setSelectedKey(m.key)}
                className={cn(
                  "group flex min-w-0 flex-1 flex-col rounded-md transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-brand motion-reduce:transition-none active:scale-[0.98] disabled:opacity-50",
                  isHovered ? "bg-muted/50" : "hover:bg-muted/30",
                )}
                aria-label={`${monthLong(m.key)}: net ${m.net < 0 ? "minus " : "plus "}${money(m.net)}`}
              >
                <div className="flex flex-1 items-end justify-center">
                  {positive && (
                    <div
                      className={cn(
                        "w-full max-w-[26px] rounded-t-[3px] bg-positive transition-opacity duration-150 motion-reduce:transition-none",
                        m.net > 0 && "min-h-[2px]",
                        isHovered ? "opacity-100 brightness-110" : "group-hover:opacity-85",
                      )}
                      style={{ height: `${h * 2}%` }}
                    />
                  )}
                </div>
                <div aria-hidden className="border-t border-border/80 w-full" />
                <div className="flex flex-1 items-start justify-center">
                  {!positive && (
                    <div
                      className={cn(
                        "w-full max-w-[26px] min-h-[2px] rounded-b-[3px] bg-negative transition-opacity duration-150 motion-reduce:transition-none",
                        isHovered ? "opacity-100 brightness-110" : "group-hover:opacity-85",
                      )}
                      style={{ height: `${h * 2}%` }}
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex gap-1">
          {monthly.map((m) => (
            <span
              key={m.key}
              className={cn(
                "min-w-0 flex-1 truncate text-center text-[10px] leading-3 text-muted-foreground",
                selectedKey === m.key && "font-bold text-foreground",
              )}
            >
              {monthLabel(m.key)}
            </span>
          ))}
        </div>

        {best && worst && best.key !== worst.key && (
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground border-t border-border/60 pt-2.5">
            <span>
              Best: <span className="font-semibold text-positive">{monthLong(best.key)}</span> +{money(best.net)}
            </span>
            <span>
              Worst: <span className="font-semibold text-negative">{monthLong(worst.key)}</span>{" "}
              {worst.net < 0 ? "−" : "+"}{money(worst.net)}
            </span>
          </div>
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
    <ul className="divide-y divide-border/60">
      {rows.map((r) => {
        const delta = hasPrev ? pctChange(r.current, r.previous) : null;
        const spark = sparkFor.get(r.categoryId ?? "none");
        return (
          <li
            key={`${r.categoryId ?? "none"}-${r.kind}`}
            className="flex items-center gap-3 py-2.5"
          >
            <Tile color={r.color} icon={r.icon} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-foreground">{r.name}</div>
              <div className="text-[11px] text-muted-foreground">
                {r.count}x · {total ? Math.round((r.current / total) * 100) : 0}% of total
              </div>
            </div>
            {spark && spark.some((v) => v > 0) && (
              <div className="hidden w-20 shrink-0 sm:block">
                <Sparkline values={spark} color={r.color} />
              </div>
            )}
            <div className="w-28 shrink-0 text-right">
              <div className="amount text-sm font-semibold tabular-nums text-foreground">
                {money(r.current)}
              </div>
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

/** Stacked share of spend per month with interactive inspection */
function CategoryMix({
  data,
  money,
}: {
  data: AnalyticsData["categoryMonthly"];
  money: (n: number) => string;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const bands = useMemo(() => {
    const top = data.series.slice(0, MIX_BANDS);
    const rest = data.series.slice(MIX_BANDS);
    const out = top.map((s) => ({
      name: s.name,
      color: s.color,
      values: s.values,
    }));
    if (rest.length) {
      out.push({
        name: `Other (${rest.length})`,
        color: "var(--muted-foreground)",
        values: data.months.map((_, i) =>
          rest.reduce((s, r) => s + r.values[i], 0),
        ),
      });
    }
    return out;
  }, [data]);

  const monthTotals = data.months.map((_, i) =>
    bands.reduce((s, b) => s + b.values[i], 0),
  );
  const anySpend = monthTotals.some((t) => t > 0);

  const activeIdx = hoveredIdx ?? (data.months.length ? data.months.length - 1 : 0);
  const activeMonth = data.months[activeIdx];
  const activeTotal = monthTotals[activeIdx];

  return (
    <Card className="gap-3 border border-border/80 bg-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Spending mix</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Category proportion over time
          </p>
        </div>
        {activeMonth && (
          <div className="text-right">
            <span className="text-xs font-semibold text-foreground">
              {monthLong(activeMonth)}
            </span>
            <span className="amount block text-[11px] text-muted-foreground">
              Total: {money(activeTotal)}
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {!anySpend ? (
          <Empty>No spending recorded in the last 12 months.</Empty>
        ) : (
          <>
            <div className="flex h-[160px] items-end gap-1.5">
              {data.months.map((m, i) => {
                const total = monthTotals[i];
                const isHovered = hoveredIdx === i;

                return (
                  <button
                    key={m}
                    type="button"
                    onMouseEnter={() => setHoveredIdx(i)}
                    onFocus={() => setHoveredIdx(i)}
                    onClick={() => setHoveredIdx(i)}
                    className={cn(
                      "flex h-full min-w-0 flex-1 flex-col justify-end rounded-md p-0.5 transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-brand motion-reduce:transition-none active:scale-[0.98] disabled:opacity-50",
                      isHovered ? "bg-muted/50" : "hover:bg-muted/30",
                    )}
                    aria-label={`${monthLong(m)}: ${money(total)}`}
                  >
                    {total === 0 ? (
                      <div className="h-0.5 w-full rounded-full bg-muted" />
                    ) : (
                      <div className="flex h-full w-full flex-col-reverse overflow-hidden rounded-[3px]">
                        {bands.map((b) => {
                          const share = (b.values[i] / total) * 100;
                          if (share <= 0) return null;
                          return (
                            <div
                              key={b.name}
                              style={{
                                height: `${share}%`,
                                backgroundColor: b.color,
                              }}
                              className={cn(
                                "transition-opacity duration-150 motion-reduce:transition-none",
                                isHovered ? "opacity-100" : "opacity-90",
                              )}
                            />
                          );
                        })}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex gap-1">
              {data.months.map((m, i) => (
                <span
                  key={m}
                  className={cn(
                    "min-w-0 flex-1 truncate text-center text-[10px] leading-3 text-muted-foreground",
                    hoveredIdx === i && "font-bold text-foreground",
                  )}
                >
                  {monthLabel(m)}
                </span>
              ))}
            </div>
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border/60 pt-3">
              {bands.map((b) => (
                <li
                  key={b.name}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: b.color }}
                  />
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
