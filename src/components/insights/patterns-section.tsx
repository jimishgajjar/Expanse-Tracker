"use client";

import { useMemo } from "react";
import { differenceInCalendarDays, format, getDay, parseISO, startOfWeek } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFormat } from "@/components/settings-provider";
import { cn } from "@/lib/utils";
import { Caveat, Empty, Hero, Meter } from "@/components/insights/parts";
import { isActive } from "@/lib/commitments";
import { todayISO } from "@/lib/dates";
import type { AnalyticsData, DayTotal } from "@/lib/analytics";
import type { RecurringDTO, TransactionDTO } from "@/lib/queries";

const WEEK = { weekStartsOn: 1 } as const; // Monday-start, matching lib/dates
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** Monday-indexed weekday (date-fns getDay is Sunday-indexed). */
const rowOf = (iso: string) => (getDay(parseISO(iso)) + 6) % 7;

export function PatternsSection({
  data,
  transactions,
  recurring,
  rangeLabel,
  showAuthors,
}: {
  data: AnalyticsData;
  transactions: TransactionDTO[];
  recurring: RecurringDTO[];
  rangeLabel: string;
  showAuthors: boolean;
}) {
  const { money } = useFormat();
  const daily = data.daily;

  const stats = useMemo(() => {
    const spendDays = daily.filter((d) => d.expense > 0);
    const total = spendDays.reduce((s, d) => s + d.expense, 0);

    // Longest run of consecutive days with no spending, plus the run ending today.
    let longest = 0;
    let run = 0;
    let current = 0;
    for (const d of daily) {
      if (d.expense > 0) {
        run = 0;
      } else {
        run += 1;
        if (run > longest) longest = run;
      }
    }
    for (let i = daily.length - 1; i >= 0 && daily[i].expense === 0; i--) current += 1;

    return {
      spendDayCount: spendDays.length,
      quietDayCount: daily.length - spendDays.length,
      avgOnSpendDays: spendDays.length ? total / spendDays.length : 0,
      longestQuiet: longest,
      currentQuiet: current,
    };
  }, [daily]);

  const weekday = useMemo(() => {
    const buckets = DAY_NAMES.map((name) => ({ name, total: 0, days: 0 }));
    for (const d of daily) {
      const b = buckets[rowOf(d.date)];
      b.total += d.expense;
      if (d.expense > 0) b.days += 1;
    }
    return buckets.map((b) => ({ ...b, avg: b.days ? b.total / b.days : 0 }));
  }, [daily]);

  // Which transactions in the selected range look like they came from a
  // recurring rule. Posted transactions carry no link back to their rule, so
  // this matches on the fields the scheduler copies across.
  const committed = useMemo(() => {
    const today = todayISO();
    const keys = new Set(
      recurring
        .filter((r) => isActive(r, today) && r.type === "expense")
        .map((r) => `${r.note.trim().toLowerCase()}|${r.categoryId ?? ""}|${r.accountId ?? ""}`),
    );
    let committedTotal = 0;
    let oneOffTotal = 0;
    let committedCount = 0;
    let oneOffCount = 0;
    for (const t of transactions) {
      if (t.type !== "expense") continue;
      const key = `${t.note.trim().toLowerCase()}|${t.categoryId ?? ""}|${t.accountId ?? ""}`;
      if (t.note.trim() && keys.has(key)) {
        committedTotal += t.amount;
        committedCount += 1;
      } else {
        oneOffTotal += t.amount;
        oneOffCount += 1;
      }
    }
    const total = committedTotal + oneOffTotal;
    return { committedTotal, oneOffTotal, committedCount, oneOffCount, total };
  }, [transactions, recurring]);

  const anySpend = daily.some((d) => d.expense > 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Hero
          accent={stats.currentQuiet > 0}
          label="No-spend streak"
          value={`${stats.currentQuiet} day${stats.currentQuiet === 1 ? "" : "s"}`}
          note={
            stats.longestQuiet > 0
              ? `Longest in the last year: ${stats.longestQuiet} day${stats.longestQuiet === 1 ? "" : "s"}`
              : "Every day in the last year had spending"
          }
        />
        <Hero
          label="Average on a spending day"
          value={money(stats.avgOnSpendDays)}
          note={`${stats.spendDayCount} spending day${stats.spendDayCount === 1 ? "" : "s"} · ${stats.quietDayCount} quiet, last 12 months`}
        />
      </div>

      <Card className="gap-3">
        <CardHeader>
          <CardTitle>Spending calendar <span className="font-normal text-muted-foreground">· last 12 months</span></CardTitle>
        </CardHeader>
        <CardContent>
          {!anySpend ? <Empty>No spending recorded in the last 12 months.</Empty> : <Heatmap daily={daily} money={money} />}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="gap-3">
          <CardHeader>
            <CardTitle>By day of week</CardTitle>
            <span className="ml-auto text-xs text-muted-foreground">average per spending day</span>
          </CardHeader>
          <CardContent>
            {!anySpend ? (
              <Empty>Nothing to profile yet.</Empty>
            ) : (
              (() => {
                const peak = Math.max(1, ...weekday.map((w) => w.avg));
                const heaviest = weekday.reduce((a, b) => (b.avg > a.avg ? b : a), weekday[0]);
                return (
                  <>
                    <ul className="space-y-2.5">
                      {weekday.map((w) => (
                        <li key={w.name}>
                          <div className="mb-1 flex items-center gap-2 text-sm">
                            <span className="w-9 shrink-0 text-xs text-muted-foreground">{w.name}</span>
                            <span className="flex-1" />
                            <span className="amount text-xs tabular-nums text-muted-foreground">
                              {w.avg > 0 ? money(w.avg) : "—"}
                            </span>
                          </div>
                          <Meter pct={(w.avg / peak) * 100} color={w.name === heaviest.name ? "var(--brand)" : "var(--muted-foreground)"} />
                        </li>
                      ))}
                    </ul>
                    {heaviest.avg > 0 && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{heaviest.name}</span> is your heaviest day, averaging{" "}
                        {money(heaviest.avg)} when you spend.
                      </p>
                    )}
                  </>
                );
              })()
            )}
          </CardContent>
        </Card>

        <Card className="gap-3">
          <CardHeader>
            <CardTitle>Committed vs one-off <span className="font-normal text-muted-foreground">· {rangeLabel}</span></CardTitle>
          </CardHeader>
          <CardContent>
            {committed.total === 0 ? (
              <Empty>No spending in this period.</Empty>
            ) : (
              <>
                <div className="flex h-3 overflow-hidden rounded-full">
                  <div
                    className="bg-brand"
                    style={{ width: `${(committed.committedTotal / committed.total) * 100}%` }}
                  />
                  <div className="flex-1 bg-muted" />
                </div>
                <ul className="mt-4 space-y-3">
                  <li className="flex items-baseline gap-2 text-sm">
                    <span className="size-2 shrink-0 rounded-full bg-brand" />
                    <span className="flex-1">Matched to a commitment</span>
                    <span className="text-[11px] text-muted-foreground">{committed.committedCount}×</span>
                    <span className="amount w-24 text-right text-xs font-medium tabular-nums">{money(committed.committedTotal)}</span>
                  </li>
                  <li className="flex items-baseline gap-2 text-sm">
                    <span className="size-2 shrink-0 rounded-full bg-muted-foreground/40" />
                    <span className="flex-1">One-off spending</span>
                    <span className="text-[11px] text-muted-foreground">{committed.oneOffCount}×</span>
                    <span className="amount w-24 text-right text-xs font-medium tabular-nums">{money(committed.oneOffTotal)}</span>
                  </li>
                </ul>
                <Caveat>
                  Posted transactions don&apos;t record which rule created them, so this matches on note, category and account against
                  your active commitments. A one-off that happens to share all three will be counted as committed.
                </Caveat>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {showAuthors && data.members.length > 1 && (
        <Card className="gap-3">
          <CardHeader>
            <CardTitle>By member <span className="font-normal text-muted-foreground">· {rangeLabel}</span></CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const peak = Math.max(1, ...data.members.map((m) => m.expense));
              const total = data.members.reduce((s, m) => s + m.expense, 0);
              return (
                <ul className="space-y-3.5">
                  {data.members.map((m) => (
                    <li key={m.userId ?? "none"}>
                      <div className="mb-1 flex items-baseline gap-2 text-sm">
                        <span className="flex-1 truncate">{m.name}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {m.count}× · {total ? Math.round((m.expense / total) * 100) : 0}%
                        </span>
                        <span className="amount w-24 text-right text-xs font-medium tabular-nums">{money(m.expense)}</span>
                      </div>
                      <Meter pct={(m.expense / peak) * 100} color="var(--brand)" />
                      {m.income > 0 && (
                        <div className="mt-1 text-[11px] text-positive">+{money(m.income)} logged as income</div>
                      )}
                    </li>
                  ))}
                </ul>
              );
            })()}
            {data.members.some((m) => m.userId === null) && (
              <Caveat>
                Entries logged before member tracking was added have no author and appear under &ldquo;Unknown&rdquo;.
              </Caveat>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** GitHub-style year grid: one column per week, one row per weekday. Intensity
 *  uses spend-red because this shows money going out — the emerald is reserved
 *  for positive money (DESIGN.md, The One Emerald Rule). */
function Heatmap({ daily, money }: { daily: DayTotal[]; money: (n: number) => string }) {
  const { weeks, cells, max } = useMemo(() => {
    const first = parseISO(daily[0].date);
    const origin = startOfWeek(first, WEEK);
    const cells = daily.map((d) => ({
      ...d,
      col: Math.floor(differenceInCalendarDays(parseISO(d.date), origin) / 7),
      row: rowOf(d.date),
    }));
    return {
      cells,
      weeks: Math.max(...cells.map((c) => c.col)) + 1,
      max: Math.max(...daily.map((d) => d.expense), 1),
    };
  }, [daily]);

  // Four intensity steps. Quantised on a square root so a single huge day
  // doesn't flatten every ordinary day into the lightest bucket.
  const level = (v: number) => (v <= 0 ? 0 : Math.min(4, Math.ceil(Math.sqrt(v / max) * 4)));
  const alpha = [0, 0.16, 0.34, 0.58, 0.85];

  // Month labels sit above the week column where each month starts.
  const monthTicks = useMemo(() => {
    const seen = new Set<string>();
    const out: { col: number; label: string }[] = [];
    for (const c of cells) {
      const key = c.date.slice(0, 7);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ col: c.col, label: format(parseISO(c.date), "MMM") });
    }
    return out.slice(1); // the first month is usually a partial week — skip its label
  }, [cells]);

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-1">
      <div className="min-w-[680px]">
        <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${weeks}, 1fr)` }}>
          {monthTicks.map((t) => (
            <span
              key={`${t.col}-${t.label}`}
              className="text-[10px] leading-3 text-muted-foreground"
              style={{ gridColumn: t.col + 1 }}
            >
              {t.label}
            </span>
          ))}
        </div>
        <div className="mt-1 flex gap-1.5">
          <div className="grid shrink-0 grid-rows-7 gap-[3px]">
            {DAY_NAMES.map((d, i) => (
              <span key={d} className="h-[11px] text-[10px] leading-[11px] text-muted-foreground">
                {i % 2 === 1 ? d : ""}
              </span>
            ))}
          </div>
          <div
            className="grid flex-1 grid-rows-7 gap-[3px]"
            style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))`, gridAutoFlow: "column" }}
          >
            {cells.map((c) => {
              const l = level(c.expense);
              return (
                <span
                  key={c.date}
                  title={`${format(parseISO(c.date), "EEE, d MMM yyyy")} · ${c.expense > 0 ? money(c.expense) : "no spending"}`}
                  className={cn("h-[11px] rounded-[2px]", l === 0 && "bg-muted")}
                  style={{
                    gridColumn: c.col + 1,
                    gridRow: c.row + 1,
                    backgroundColor: l === 0 ? undefined : `color-mix(in srgb, var(--negative) ${alpha[l] * 100}%, transparent)`,
                  }}
                />
              );
            })}
          </div>
        </div>
        <div className="mt-2.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span>Less</span>
          {alpha.map((a, i) => (
            <span
              key={i}
              className={cn("size-[11px] rounded-[2px]", i === 0 && "bg-muted")}
              style={{ backgroundColor: i === 0 ? undefined : `color-mix(in srgb, var(--negative) ${a * 100}%, transparent)` }}
            />
          ))}
          <span>More</span>
          <span className="ml-auto">Peak day {money(max)}</span>
        </div>
      </div>
    </div>
  );
}
