"use client";

import { CalendarDays, Handshake, Target, Clock } from "lucide-react";
import { BudgetsCard } from "./budgets-card";
import { RecurringManager } from "./recurring-manager";
import { GoalsManager } from "./goals-manager";
import { SplitManager } from "./split-manager";
import { Button } from "./ui/button";
import { useFormat } from "./settings-provider";
import { cn } from "@/lib/utils";
import type {
  AccountDTO,
  BudgetProgressDTO,
  CategoryDTO,
  GoalDTO,
  RecurringDTO,
  SplitData,
} from "@/lib/queries";

export function PlanningTab({
  budgets,
  categories,
  accounts,
  recurring,
  goals,
  split,
  canEdit,
}: {
  budgets: BudgetProgressDTO[];
  categories: CategoryDTO[];
  accounts: AccountDTO[];
  recurring: RecurringDTO[];
  goals: GoalDTO[];
  split: SplitData;
  canEdit: boolean;
}) {
  const { money } = useFormat();

  return (
    <div className="space-y-5">
      {/* 1. Monthly Category Budgets */}
      <div id="monthly-budgets" className="scroll-mt-4"><BudgetsCard
        budgets={budgets}
        categories={categories}
        canEdit={canEdit}
      /></div>

      {/* 2. Subscriptions & Recurring Bills */}
      <section id="upcoming-payments" className="dashboard-panel scroll-mt-4 p-4 sm:p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Subscriptions & Bills
              </h2>
              <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {recurring.length} active
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Scheduled bills, subscription charges, and recurring income.
            </p>
          </div>
          {canEdit && (
            <RecurringManager
              recurring={recurring}
              accounts={accounts}
              categories={categories}
              trigger={
                <Button variant="outline" size="sm" className="h-9 rounded-xl px-3 text-xs font-medium gap-1.5 shadow-2xs hover:bg-muted/60">
                  <CalendarDays className="size-3.5" />
                  Manage recurring
                </Button>
              }
            />
          )}
        </div>

        <div className="divide-y divide-border/60">
          {[...recurring]
            .sort((a, b) => a.nextDate.localeCompare(b.nextDate))
            .map((r) => {
              const ended =
                (r.endDate && r.nextDate > r.endDate) ||
                (r.maxOccurrences !== null &&
                  r.occurrenceCount >= r.maxOccurrences);

              return (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 hover:bg-muted/30 px-2 -mx-2 rounded-xl transition-colors"
                >
                  <div className="min-w-0 flex items-center gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                      <CalendarDays className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {r.note || "Recurring " + r.type}
                        </p>
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground ">
                          {r.frequency}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1.5">
                        <Clock className="size-3" />
                        <span>{ended ? "Ended" : "Next: " + r.nextDate}</span>
                        {r.maxOccurrences !== null && (
                          <span>
                            · {r.occurrenceCount}/{r.maxOccurrences} completed
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <p
                      className={cn(
                        "font-mono text-sm sm:text-base font-bold tabular-nums",
                        r.type === "income" ? "text-positive" : "text-foreground",
                      )}
                    >
                      {r.type === "income" ? "+" : "-"}
                      {money(r.amount)}
                    </p>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">
                      {r.autoPost ? "Automatic" : "Manual review"}
                    </span>
                  </div>
                </div>
              );
            })}

          {!recurring.length && (
            <div className="py-8 text-center text-muted-foreground text-xs">
              No recurring bills or scheduled payments found.
            </div>
          )}
        </div>
      </section>

      {/* 3. Savings Goals */}
      <section className="dashboard-panel p-4 sm:p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Savings Goals
              </h2>
              <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {goals.length} target{goals.length === 1 ? "" : "s"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Long-term savings targets and milestones.
            </p>
          </div>
          {canEdit && (
            <GoalsManager
              goals={goals}
              trigger={
                <Button variant="outline" size="sm" className="h-9 rounded-xl px-3 text-xs font-medium gap-1.5 shadow-2xs hover:bg-muted/60">
                  <Target className="size-3.5" />
                  Manage goals
                </Button>
              }
            />
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {goals.map((g) => {
            const pct = Math.min(100, Math.round((g.savedAmount / g.targetAmount) * 100));
            const remaining = Math.max(0, g.targetAmount - g.savedAmount);

            return (
              <div
                key={g.id}
                className="rounded-xl border border-border/60 bg-muted/20 p-4 transition-colors hover:bg-muted/40"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm text-foreground truncate">{g.name}</span>
                  <span className="font-mono text-xs font-semibold text-brand rounded-md bg-brand/10 px-2 py-0.5">
                    {pct}%
                  </span>
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-muted my-2.5">
                  <div
                    className="h-full rounded-full bg-brand transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="flex justify-between items-baseline text-xs mt-2">
                  <span className="font-mono font-semibold text-foreground">
                    {money(g.savedAmount)}{" "}
                    <span className="font-normal text-muted-foreground text-[11px]">
                      of {money(g.targetAmount)}
                    </span>
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {remaining === 0 ? "Achieved" : `${money(remaining)} remaining`}
                  </span>
                </div>
                {g.deadline && (
                  <p className="mt-1 text-[11px] text-muted-foreground">Target: {g.deadline}</p>
                )}
              </div>
            );
          })}
          {!goals.length && (
            <div className="col-span-full py-8 text-center text-xs text-muted-foreground">
              Give your next savings target a name and amount to track progress.
            </div>
          )}
        </div>
      </section>

      {/* 4. Shared Expenses */}
      <section className="flex flex-wrap items-center justify-between gap-4 dashboard-panel p-4 sm:p-5">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Shared Household Expenses
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Track shared bills, who paid, and automated settlement breakdowns.
          </p>
        </div>
        <SplitManager
          data={split}
          canEdit={canEdit}
          trigger={
            <Button variant="outline" size="sm" className="h-9 rounded-xl px-3 text-xs font-medium gap-1.5 shadow-2xs hover:bg-muted/60">
              <Handshake className="size-3.5" />
              Review shared balances
            </Button>
          }
        />
      </section>
    </div>
  );
}
