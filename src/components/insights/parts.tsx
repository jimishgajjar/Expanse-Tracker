"use client";

// Shared primitives for the Insights sections. Kept deliberately small and
// flat: hairlines carry structure, the emerald stays reserved for positive
// money and active state, and every figure renders tabular (DESIGN.md).

import type { ReactNode } from "react";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";

/** Percentage change, or null when there's no baseline to compare against. */
export function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

/** A movement indicator. `goodWhen` decides the tone: spending more is bad,
 *  earning more is good — the arrow direction alone can't say which. */
export function DeltaPill({
  pct,
  goodWhen = "down",
  suffix,
  className,
}: {
  pct: number | null;
  goodWhen?: "up" | "down";
  suffix?: string;
  className?: string;
}) {
  if (pct === null || pct === 0) {
    return <span className={cn("text-[11px] text-muted-foreground", className)}>{pct === 0 ? "no change" : "new"}</span>;
  }
  const rising = pct > 0;
  const good = goodWhen === "up" ? rising : !rising;
  return (
    <span className={cn("text-[11px] font-medium tabular-nums", good ? "text-positive" : "text-negative", className)}>
      {rising ? "▲" : "▼"} {Math.abs(pct)}%{suffix ? ` ${suffix}` : ""}
    </span>
  );
}

/** The one Display-scale figure a section is allowed (DESIGN.md, One Hero Rule). */
export function Hero({
  label,
  value,
  tone,
  note,
  accent = false,
  children,
}: {
  label: string;
  value: string;
  tone?: string;
  note?: ReactNode;
  accent?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border p-4 sm:p-5", accent && "border-brand/20 bg-brand/[0.04]")}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className={cn("amount mt-1 text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl", tone)}>{value}</div>
      {note && <div className="mt-1.5 text-xs text-muted-foreground">{note}</div>}
      {children}
    </div>
  );
}

/** Hairline-divided cells — a statement summary rather than a row of cards. */
export function Lattice({ cells }: { cells: { k: string; v: string; tone?: string; sub?: ReactNode }[] }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4">
      {cells.map((c) => (
        <div key={c.k} className="bg-card p-3.5">
          <div className="truncate text-xs font-medium text-muted-foreground">{c.k}</div>
          <div className={cn("amount mt-1.5 truncate text-lg font-semibold tracking-tight tabular-nums sm:text-xl", c.tone)}>{c.v}</div>
          {c.sub && <div className="mt-1 truncate">{c.sub}</div>}
        </div>
      ))}
    </div>
  );
}

/** A tinted category/account glyph square — the product's icon convention. */
export function Tile({ color, icon, size = 24 }: { color: string; icon: string; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded"
      style={{ width: size, height: size, backgroundColor: `${color}22`, color }}
    >
      <Icon name={icon} size={Math.round(size * 0.55)} />
    </span>
  );
}

/** Compact trend line for a single series — no axes, just the shape. */
export function Sparkline({
  values,
  color,
  className,
  height = 22,
}: {
  values: number[];
  color: string;
  className?: string;
  height?: number;
}) {
  if (values.length < 2) return <span className={cn("inline-block", className)} style={{ height }} />;
  const W = 100;
  const H = 30;
  const max = Math.max(...values);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const x = (i: number) => (i / (values.length - 1)) * W;
  const y = (v: number) => H - ((v - min) / span) * H;
  const d = values.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" ");
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={cn("w-full", className)}
      style={{ height }}
      aria-hidden
    >
      <path d={d} fill="none" stroke={color} strokeWidth="1.75" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Horizontal proportion bar used across the breakdown lists. */
export function Meter({ pct, color, over = false }: { pct: number; color: string; over?: boolean }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: over ? "var(--negative)" : color }}
      />
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>;
}

/** Explains where a derived number comes from, so a reader can trust or
 *  discount it. Used wherever a figure is projected or heuristic. */
export function Caveat({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{children}</p>;
}
