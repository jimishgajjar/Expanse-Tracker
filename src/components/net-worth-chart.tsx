"use client";

import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFormat } from "@/components/settings-provider";
import type { NetWorthPoint } from "@/lib/queries";

export function NetWorthChart({ series }: { series: NetWorthPoint[] }) {
  const { money } = useFormat();
  if (series.length < 2) return null;

  const W = 600, H = 150, pad = 4;
  const values = series.map((p) => p.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const span = max - min || 1;
  const x = (i: number) => pad + (i / (series.length - 1)) * (W - 2 * pad);
  const y = (v: number) => H - pad - ((v - min) / span) * (H - 2 * pad);
  const line = "M " + series.map((p, i) => `${x(i)},${y(p.value)}`).join(" L ");
  const area = `${line} L ${x(series.length - 1)},${H - pad} L ${x(0)},${H - pad} Z`;
  const last = series[series.length - 1].value;
  const monthLabel = (k: string) => format(parseISO(`${k}-01`), "MMM yy");

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>Net worth over time</CardTitle>
        <span className="ml-auto font-mono text-sm font-semibold">{money(last)}</span>
      </CardHeader>
      <CardContent>
        <svg viewBox={`0 0 ${W} ${H}`} className="h-36 w-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="nw-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--positive)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--positive)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#nw-grad)" />
          <path d={line} fill="none" stroke="var(--positive)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>{monthLabel(series[0].key)}</span>
          <span>{monthLabel(series[series.length - 1].key)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
