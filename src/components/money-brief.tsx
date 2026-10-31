"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { addDays, format, parseISO } from "date-fns";
import { ArrowUpRight, CalendarCheck, Target, TrendingDown, TrendingUp } from "lucide-react";
import { todayISO } from "@/lib/dates";
import { useFormat } from "./settings-provider";
import { cn } from "@/lib/utils";
import type { BudgetProgressDTO, RecurringDTO } from "@/lib/queries";

export function MoneyBrief({
  recurring,
  budgets,
  expense,
  comparison,
  rangeLabel,
}: {
  recurring: RecurringDTO[];
  budgets: BudgetProgressDTO[];
  expense: number;
  comparison?: { prevIncome: number; prevExpense: number } | null;
  rangeLabel: string;
}) {
  const { money } = useFormat();
  const params = new URLSearchParams(useSearchParams().toString());
  params.set("tab", "transactions");
  params.set("type", "expense");

  const today = todayISO();
  const end = format(addDays(parseISO(today), 7), "yyyy-MM-dd");
  const due = recurring.filter(
    (r) =>
      r.type === "expense" &&
      r.nextDate >= today &&
      r.nextDate < end &&
      (!r.endDate || r.nextDate <= r.endDate) &&
      (r.maxOccurrences === null || r.occurrenceCount < r.maxOccurrences),
  );
  const remaining = budgets.reduce((sum, b) => sum + b.budget - b.spent, 0);
  const change =
    comparison && comparison.prevExpense > 0
      ? ((expense - comparison.prevExpense) / comparison.prevExpense) * 100
      : null;

  return (
    <section aria-label="Financial intelligence" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {/* 1. Upcoming in 7 Days */}
      <Link
        href="/?tab=planning#upcoming-payments"
        className="group relative flex flex-col justify-between rounded-xl border border-border/80 bg-card p-4 transition-colors hover:border-brand/40 hover:bg-muted/20 active:scale-[0.99] motion-reduce:transition-none motion-reduce:transform-none focus-visible:outline-2 focus-visible:outline-brand"
      >
        <div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="flex items-center gap-1.5 text-xs font-medium">
              <CalendarCheck className="size-3.5 text-brand" />
              <span>Due next 7 days</span>
            </span>
            <ArrowUpRight className="size-3.5 opacity-0 transition-transform motion-reduce:transition-none group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </div>
          <p className="amount mt-2 text-xl font-bold tracking-tight text-foreground">
            {money(due.reduce((sum, r) => sum + r.amount, 0))}
          </p>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {due.length} scheduled {due.length === 1 ? "payment" : "payments"}
          {due.some((r) => !r.autoPost) ? " · manual estimates" : ""}
        </p>
      </Link>

      {/* 2. Monthly Budgets */}
      <Link
        href="/?tab=planning#monthly-budgets"
        className="group relative flex flex-col justify-between rounded-xl border border-border/80 bg-card p-4 transition-colors hover:border-brand/40 hover:bg-muted/20 active:scale-[0.99] motion-reduce:transition-none motion-reduce:transform-none focus-visible:outline-2 focus-visible:outline-brand"
      >
        <div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="flex items-center gap-1.5 text-xs font-medium">
              <Target className="size-3.5 text-positive" />
              <span>Monthly budget headroom</span>
            </span>
            <ArrowUpRight className="size-3.5 opacity-0 transition-transform motion-reduce:transition-none group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </div>
          <p
            className={cn(
              "amount mt-2 text-xl font-bold tracking-tight",
              budgets.length && remaining < 0 ? "text-negative" : "text-foreground",
            )}
          >
            {budgets.length ? money(Math.abs(remaining)) : "Set a budget"}
          </p>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {budgets.length
            ? remaining < 0
              ? "Over combined category limits"
              : "Remaining across active limits"
            : "Choose limits for categories you track"}
        </p>
      </Link>

      {/* 3. Spending Velocity */}
      <Link
        href={`/?${params}`}
        className="group relative flex flex-col justify-between rounded-xl border border-border/80 bg-card p-4 transition-colors hover:border-brand/40 hover:bg-muted/20 active:scale-[0.99] motion-reduce:transition-none motion-reduce:transform-none focus-visible:outline-2 focus-visible:outline-brand"
      >
        <div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="flex items-center gap-1.5 text-xs font-medium">
              {change !== null && change > 0 ? (
                <TrendingUp className="size-3.5 text-negative" />
              ) : (
                <TrendingDown className="size-3.5 text-positive" />
              )}
              <span>Spending pace</span>
            </span>
            <ArrowUpRight className="size-3.5 opacity-0 transition-transform motion-reduce:transition-none group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </div>
          <p className="amount mt-2 text-xl font-bold tracking-tight text-foreground">
            {change === null
              ? money(expense)
              : `${Math.abs(change).toFixed(1)}% ${change > 0 ? "higher" : change < 0 ? "lower" : "flat"}`}
          </p>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {change === null
            ? `Total spent during ${rangeLabel}`
            : `Versus prior ${rangeLabel}`}
        </p>
      </Link>
    </section>
  );
}
