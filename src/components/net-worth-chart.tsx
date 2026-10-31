"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useFormat } from "@/components/settings-provider";
import { cn } from "@/lib/utils";
import type { NetWorthPoint } from "@/lib/queries";

export function NetWorthChart({ series }: { series: NetWorthPoint[] }) {
  const { money } = useFormat();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (series.length < 2) return null;

  const W = 600;
  const H = 160;
  const pad = 12;
  const values = series.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const x = (i: number) => pad + (i / (series.length - 1)) * (W - 2 * pad);
  const y = (v: number) => H - pad - ((v - min) / span) * (H - 2 * pad);

  const line = series.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)},${y(p.value).toFixed(2)}`).join(" ");
  const area = `${line} L ${x(series.length - 1).toFixed(2)},${H - pad} L ${x(0).toFixed(2)},${H - pad} Z`;

  const first = series[0].value;
  const last = series[series.length - 1].value;
  const totalChange = last - first;
  const totalPct = first ? Math.round((totalChange / Math.abs(first)) * 100) : 0;
  const isUp = totalChange >= 0;

  const activeIndex = hoverIndex ?? series.length - 1;
  const activePoint = series[activeIndex];
  const activeChange = activePoint.value - first;
  const activePct = first ? Math.round((activeChange / Math.abs(first)) * 100) : 0;

  const monthLabel = (k: string) => {
    try {
      return format(parseISO(`${k}-01`), "MMM yyyy");
    } catch {
      return k;
    }
  };

  const strokeColor = isUp ? "var(--positive)" : "var(--negative)";

  return (
    <div className="dashboard-panel flex flex-col justify-between rounded-xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-foreground">
              Net worth trajectory
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Historical ledger valuation over time
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                activeChange >= 0
                  ? "bg-positive/10 text-positive"
                  : "bg-negative/10 text-negative",
              )}
            >
              {activeChange >= 0 ? (
                <TrendingUp className="size-3" />
              ) : (
                <TrendingDown className="size-3" />
              )}
              <span>{activePct > 0 ? `+${activePct}%` : `${activePct}%`}</span>
            </span>
          </div>
        </div>

        {/* Active Value Display Bar */}
        <div className="mt-3 flex items-baseline justify-between">
          <div className="min-w-0">
            <span className="text-[11px] font-medium text-muted-foreground">
              {hoverIndex !== null ? monthLabel(activePoint.key) : "Current valuation"}
            </span>
            <div className="amount text-2xl font-bold tracking-tight text-foreground">
              {money(activePoint.value)}
            </div>
          </div>
          <div className="text-right text-[11px] text-muted-foreground">
            <span>Overall: </span>
            <span
              className={cn(
                "amount font-bold",
                totalChange >= 0 ? "text-positive" : "text-negative",
              )}
            >
              {totalChange >= 0 ? "+" : ""}
              {money(totalChange)} ({totalPct >= 0 ? `+${totalPct}%` : `${totalPct}%`})
            </span>
          </div>
        </div>
      </div>

      {/* Interactive SVG Chart */}
      <div className="relative mt-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-40 w-full overflow-visible"
          preserveAspectRatio="none"
          role="img"
          aria-label="Net worth history chart"
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="nw-hero-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Area Fill */}
          <path d={area} fill="url(#nw-hero-grad)" />

          {/* Trend Line */}
          <path
            d={line}
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.5"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Vertical Crosshair Line when hovered */}
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

          {/* Active Data Point */}
          <circle
            cx={x(activeIndex)}
            cy={y(activePoint.value)}
            r={hoverIndex !== null ? 5.5 : 4}
            fill={strokeColor}
            stroke="var(--card)"
            strokeWidth="2.5"
            className="transition-transform duration-150 motion-reduce:transition-none"
          />

          {/* Transparent interactive vertical hit columns */}
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
                onTouchStart={() => setHoverIndex(i)}
              />
            );
          })}
        </svg>

        {/* X-Axis Month Legend */}
        <div className="mt-2 flex justify-between text-[11px] font-medium text-muted-foreground">
          <span>{monthLabel(series[0].key)}</span>
          <span className="text-[10px] text-muted-foreground/60">Hover to inspect point</span>
          <span>{monthLabel(series[series.length - 1].key)}</span>
        </div>
      </div>
    </div>
  );
}
