"use client";

import type { ReactNode } from "react";
import { useInPage } from "./manager-panel";
import { cn } from "@/lib/utils";

/**
 * Layout for workspace tools (categories, subscriptions, goals, shared expenses, members).
 * On its own page: a totals line, then the ledger on the left and the "add" column on the
 * right, which stays in view while the list scrolls. In a window everything stacks, with
 * the add form before the list as it always was.
 */
export function ToolPage({ summary, main, aside }: { summary?: ReactNode; main: ReactNode; aside?: ReactNode }) {
  const page = useInPage();
  if (!page) return <div className="space-y-4">{summary}{aside}{main}</div>;
  return (
    <div className="space-y-6">
      {summary}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">{main}</div>
        {aside && <aside className="min-w-0 space-y-4 xl:sticky xl:top-16">{aside}</aside>}
      </div>
    </div>
  );
}

/** A statement-style totals line: figures separated by hairlines, not a row of cards. */
export function ToolSummary({ items }: { items: { label: string; value: ReactNode; hint?: ReactNode; tone?: "positive" | "negative" }[] }) {
  return (
    <dl className="grid overflow-hidden rounded-xl border border-border bg-card sm:grid-flow-col sm:auto-cols-fr">
      {items.map((it, i) => (
        <div key={it.label} className={cn("flex min-w-0 items-baseline justify-between gap-3 px-4 py-3 sm:block sm:px-5 sm:py-3.5", i > 0 && "border-t border-border sm:border-t-0 sm:border-l")}>
          <dt className="text-xs text-muted-foreground">{it.label}</dt>
          <dd className={cn("amount truncate text-base font-semibold tracking-tight sm:mt-1 sm:text-xl", it.tone === "positive" && "text-positive", it.tone === "negative" && "text-negative")}>{it.value}</dd>
          {it.hint && <dd className="mt-0.5 hidden truncate text-xs text-muted-foreground sm:block">{it.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

/** One titled ledger: a heading line with an optional figure, then ruled rows on a single surface. */
export function ToolSection({ title, meta, actions, children, className }: { title: ReactNode; meta?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0", className)}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-1">
        <h2 className="text-sm font-semibold">{title}</h2>
        {meta && <span className="amount text-xs text-muted-foreground">{meta}</span>}
        {actions}
      </div>
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">{children}</div>
    </section>
  );
}

/** Empty state that says what to do next. */
export function ToolEmpty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}
