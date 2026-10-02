"use client";

import {
  ArrowRight,
  CalendarDays,
  Check,
  CircleAlert,
} from "lucide-react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { Button } from "./ui/button";
import { Icon } from "./icon";
import { useFormat } from "./settings-provider";
import { todayISO } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { BudgetProgressDTO, RecurringDTO } from "@/lib/queries";

export function RadarPanel({
  watch,
  upcoming,
  onPlanning,
}: {
  watch: BudgetProgressDTO[];
  upcoming: RecurringDTO[];
  onPlanning: () => void;
}) {
  const { money } = useFormat();
  const today = parseISO(todayISO());

  return (
    <section
      aria-labelledby="radar-title"
      className="flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xs"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border/70 p-4">
        <div>
          <h2 id="radar-title" className="text-sm font-semibold tracking-tight text-foreground">
            On your radar
          </h2>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Upcoming bills & category budget velocity
          </p>
        </div>
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand ring-1 ring-brand/20 shadow-2xs">
          <CalendarDays className="size-4" aria-hidden />
        </span>
      </div>

      <div className="flex-1 px-4">
        {/* 1. Budget Alerts */}
        {watch.length > 0 && (
          <div className="py-3">
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-negative">
              <CircleAlert className="size-3.5" aria-hidden />
              {watch.length} budget {watch.length === 1 ? "alert" : "alerts"}
            </h3>
            <div className="divide-y divide-border/60">
              {watch.slice(0, 2).map((b) => {
                const used = Math.round((b.spent / b.budget) * 100);
                const isCritical = used >= 90;
                return (
                  <button
                    key={b.categoryId}
                    type="button"
                    onClick={onPlanning}
                    className="group block w-full rounded-lg py-2.5 text-left transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="grid size-6 shrink-0 place-items-center rounded-md"
                        style={{
                          backgroundColor: `${b.color || "#0f7b6c"}18`,
                          color: b.color || "#0f7b6c",
                        }}
                      >
                        <Icon name={b.icon} size={14} />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                        {b.name}
                      </span>
                      <span
                        className={cn(
                          "amount shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold",
                          isCritical
                            ? "bg-negative/10 text-negative"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                        )}
                      >
                        {used}% used
                      </span>
                    </div>

                    <div
                      className="mt-2 block h-1.5 overflow-hidden rounded-full bg-muted"
                      aria-hidden
                    >
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          isCritical ? "bg-negative" : "bg-amber-500",
                        )}
                        style={{ width: `${Math.min(100, used)}%` }}
                      />
                    </div>

                    <div className="mt-1.5 flex flex-wrap justify-between gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span>
                        {money(b.spent)} of {money(b.budget)}
                      </span>
                      <span className={cn(isCritical && "font-medium text-negative")}>
                        {b.spent >= b.budget
                          ? "Limit reached"
                          : `${money(b.budget - b.spent)} left`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. Upcoming Scheduled Items */}
        {upcoming.length > 0 && (
          <div className={cn("py-3", watch.length > 0 && "border-t border-border/60")}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-muted-foreground">
                Next scheduled bills
              </h3>
              <span className="text-[11px] font-medium text-muted-foreground">
                {upcoming.length} upcoming
              </span>
            </div>

            <div className="divide-y divide-border/60">
              {upcoming.map((r) => {
                const date = parseISO(r.nextDate);
                const days = differenceInCalendarDays(date, today);
                const isOverdue = days < 0;
                const isToday = days === 0;
                const isTomorrow = days === 1;
                const timing = isOverdue
                  ? "Overdue"
                  : isToday
                    ? "Today"
                    : isTomorrow
                      ? "Tomorrow"
                      : `In ${days}d`;

                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={onPlanning}
                    className="group flex w-full items-center gap-3 rounded-lg py-2.5 text-left transition-colors hover:bg-muted/40"
                  >
                    <time
                      dateTime={r.nextDate}
                      title={format(date, "d MMMM yyyy")}
                      className={cn(
                        "flex w-10 shrink-0 flex-col items-center rounded-lg py-1.5 text-center text-xs font-semibold",
                        isOverdue
                          ? "bg-negative/10 text-negative border border-negative/20"
                          : isToday
                            ? "bg-brand/10 text-brand border border-brand/20"
                            : isTomorrow || days <= 3
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                              : "bg-muted text-foreground border border-border/40",
                      )}
                    >
                      <span className="text-[10px] uppercase font-bold tracking-tight opacity-75">
                        {format(date, "MMM")}
                      </span>
                      <span className="amount text-sm font-bold leading-tight">
                        {format(date, "d")}
                      </span>
                    </time>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-xs font-semibold text-foreground">
                          {r.note || "Recurring payment"}
                        </span>
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider",
                            isOverdue
                              ? "bg-negative/10 text-negative"
                              : isToday
                                ? "bg-brand/10 text-brand"
                                : "bg-muted text-muted-foreground",
                          )}
                        >
                          {timing}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {r.commitmentType || "Recurring"} · {r.frequency}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <span
                        className={cn(
                          "amount block text-xs font-bold",
                          r.type === "income" ? "text-positive" : "text-foreground",
                        )}
                      >
                        {r.type === "income" ? "+" : "-"}
                        {money(r.amount)}
                      </span>
                      {!r.autoPost && (
                        <span className="block text-[10px] text-muted-foreground">
                          Est.
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. Empty State (Calm & Clear) */}
        {!watch.length && !upcoming.length && (
          <div className="py-8 text-center">
            <div className="mx-auto mb-2.5 grid size-9 place-items-center rounded-full bg-brand/10 text-brand">
              <Check className="size-4" aria-hidden />
            </div>
            <p className="text-xs font-semibold text-foreground">
              Everything is on track
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground max-w-xs mx-auto">
              No budget alerts and no recurring payments due in the immediate days.
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-border/60 bg-muted/20 p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between text-xs font-semibold text-brand hover:text-brand hover:bg-brand/5"
          onClick={onPlanning}
        >
          <span>Open planning & budgets</span>
          <ArrowRight className="size-3.5" />
        </Button>
      </div>
    </section>
  );
}
