"use client";

import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
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
      className="overflow-hidden rounded-2xl border bg-card"
    >
      <div className="flex items-start justify-between gap-3 border-b p-5 sm:p-6">
        <div>
          <h2 id="radar-title" className="font-semibold">
            On your radar
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Upcoming payments & budget alerts
          </p>
        </div>
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
          <CalendarDays className="size-5" aria-hidden />
        </span>
      </div>
      <div className="px-5 sm:px-6">
        {watch.length > 0 && (
          <div className="py-5">
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold text-negative">
              <CircleAlert className="size-3.5" aria-hidden />
              {watch.length} budget {watch.length === 1 ? "alert" : "alerts"}
            </h3>
            <div className="divide-y">
              {watch.slice(0, 2).map((b) => {
                const used = Math.round((b.spent / b.budget) * 100);
                return (
                  <button
                    key={b.categoryId}
                    type="button"
                    onClick={onPlanning}
                    className="group block w-full rounded-lg py-3 text-left transition-colors hover:bg-muted/50"
                  >
                    <span className="flex items-center gap-2">
                      <Icon
                        name={b.icon}
                        size={16}
                        className="shrink-0 text-muted-foreground"
                      />
                      <span className="min-w-0 flex-1 break-words text-sm font-medium">
                        {b.name}
                      </span>
                      <span className="amount shrink-0 text-xs font-semibold text-negative">
                        {used}% used
                      </span>
                    </span>
                    <span
                      className="mt-2 block h-1.5 overflow-hidden rounded-full bg-muted"
                      aria-hidden
                    >
                      <span
                        className="block h-full rounded-full bg-negative"
                        style={{ width: `${Math.min(100, used)}%` }}
                      />
                    </span>
                    <span className="mt-2 flex flex-wrap justify-between gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        {money(b.spent)} of {money(b.budget)}
                      </span>
                      <span>
                        {b.spent >= b.budget
                          ? "Limit reached"
                          : `${money(b.budget - b.spent)} left`}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {upcoming.length > 0 && (
          <div className={cn("py-5", watch.length > 0 && "border-t")}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-muted-foreground">
                Next scheduled
              </h3>
              <span className="text-xs text-muted-foreground">
                {upcoming.length} {upcoming.length === 1 ? "item" : "items"}
              </span>
            </div>
            <div className="divide-y">
              {upcoming.map((r) => {
                const date = parseISO(r.nextDate);
                const days = differenceInCalendarDays(date, today);
                const timing =
                  days < 0
                    ? "Overdue"
                    : days === 0
                      ? "Today"
                      : days === 1
                        ? "Tomorrow"
                        : `In ${days} days`;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={onPlanning}
                    className="group flex w-full items-center gap-3 rounded-lg py-4 text-left transition-colors hover:bg-muted/50"
                  >
                    <time
                      dateTime={r.nextDate}
                      title={format(date, "d MMMM yyyy")}
                      className={cn(
                        "flex w-11 shrink-0 flex-col items-center rounded-lg py-2",
                        days <= 0
                          ? "bg-negative/10 text-negative"
                          : "bg-muted text-foreground",
                      )}
                    >
                      <span className="text-[10px] font-medium uppercase leading-none">
                        {format(date, "MMM")}
                      </span>
                      <span className="amount mt-1 text-lg font-semibold leading-none">
                        {format(date, "d")}
                      </span>
                      <span className="sr-only">{format(date, "yyyy")}</span>
                    </time>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-sm font-medium [overflow-wrap:anywhere]">
                        {r.note ||
                          (r.type === "income"
                            ? "Recurring income"
                            : "Recurring payment")}
                      </span>
                      <span
                        className={cn(
                          "mt-1 block text-xs",
                          days <= 0 ? "text-negative" : "text-muted-foreground",
                        )}
                      >
                        {timing}
                        {r.type === "income" && " · Income"}
                      </span>
                      {!r.autoPost && (
                        <span className="mt-1 block text-xs text-muted-foreground">
                          Log actual amount
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-right">
                      <span
                        className={cn(
                          "amount block text-sm font-semibold",
                          r.type === "income" && "text-positive",
                        )}
                      >
                        {r.type === "income" && "+"}
                        {money(r.amount)}
                      </span>
                      {!r.autoPost && (
                        <span className="mt-1 block text-xs text-muted-foreground">
                          Estimate
                        </span>
                      )}
                    </span>
                    <ChevronRight
                      className="hidden size-3.5 shrink-0 text-muted-foreground 2xl:block"
                      aria-hidden
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {!watch.length && !upcoming.length && (
          <div className="py-8 text-center">
            <Check className="mx-auto mb-3 size-6 text-brand" aria-hidden />
            <p className="text-sm font-medium">Nothing needs your attention</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Add a budget or scheduled payment to keep track of what is coming
              next.
            </p>
          </div>
        )}
      </div>
      <div className="border-t bg-muted/20 p-4">
        <Button
          variant="ghost"
          className="min-h-11 w-full justify-between text-brand hover:text-brand"
          onClick={onPlanning}
        >
          Open planning
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </section>
  );
}
