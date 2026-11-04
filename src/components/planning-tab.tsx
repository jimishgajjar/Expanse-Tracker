"use client";

import { differenceInCalendarDays, parseISO } from "date-fns";
import {use,useEffect} from "react";
import {MerchantRulesContext} from "./settings-provider";
import {BalanceForecast} from "./balance-forecast";
import {MonthlyPlanner} from "./monthly-planner";
import { HouseholdCheckIn } from "./weekly-household-check-in";
import { weeklyHouseholdCheckIn } from "@/lib/weekly-household";
import {
  CalendarDays,
  Handshake,
  Target,
  Clock,
  CheckCircle2,
  AlertCircle,
  Repeat,
} from "lucide-react";
import { BudgetsCard } from "./budgets-card";
import { RecurringManager } from "./recurring-manager";
import { GoalsManager } from "./goals-manager";
import { SplitManager } from "./split-manager";
import { Button } from "./ui/button";
import { useFormat } from "./settings-provider";
import { todayISO } from "@/lib/dates";
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
  workspace,
  forecastAccounts,
  budgets,
  categories,
  accounts,
  recurring,
  goals,
  split,
  canEdit,
}: {
  workspace:string;
  forecastAccounts:AccountDTO[];
  budgets: BudgetProgressDTO[];
  categories: CategoryDTO[];
  accounts: AccountDTO[];
  recurring: RecurringDTO[];
  goals: GoalDTO[];
  split: SplitData;
  canEdit: boolean;
}) {
  const { money } = useFormat();
  const localPlanning=use(MerchantRulesContext);
  // Planning mounts after its data arrives, so the browser may have tried the
  // fragment before its destination existed.
  useEffect(()=>{
    const id=window.location.hash.slice(1);
    if(!["weekly-check-in","balance-forecast","monthly-plan","monthly-budgets","savings-goals","upcoming-payments","shared-expenses"].includes(id))return;
    document.getElementById(id)?.scrollIntoView({block:"start"});
  },[]);
  const day = todayISO();
  const today = parseISO(day);
  const checkIn = weeklyHouseholdCheckIn(workspace, day, split, recurring, goals);

  // Normalized monthly equivalent calculation
  const monthlyEquivalent = (amount: number, freq: string) => {
    switch (freq.toLowerCase()) {
      case "daily":
        return amount * 30.4;
      case "weekly":
        return (amount * 52) / 12;
      case "bi-weekly":
      case "biweekly":
        return (amount * 26) / 12;
      case "quarterly":
        return amount / 3;
      case "yearly":
      case "annual":
      case "annually":
        return amount / 12;
      default:
        return amount;
    }
  };

  const totalMonthlyCommitments = recurring
    .filter((r) => r.type === "expense")
    .reduce((sum, r) => sum + monthlyEquivalent(r.amount, r.frequency), 0);

  const isSettled = (checkIn?.reimbursements.length ?? split.balances.length) === 0;

  return (
    <div className="space-y-5">
      {checkIn && <HouseholdCheckIn review={checkIn} />}
      {localPlanning&&<BalanceForecast workspace={workspace} accounts={forecastAccounts} canEdit={canEdit}/>}
      {localPlanning&&<MonthlyPlanner workspace={workspace} categories={categories} budgets={budgets} goals={goals} canEdit={canEdit}/>}
      {/* 1. Monthly Category Budgets */}
      <div id="monthly-budgets" className="scroll-mt-4">
        <BudgetsCard
          budgets={budgets}
          categories={categories}
          canEdit={canEdit}
        />
      </div>

      {/* 2. Subscriptions & Recurring Bills */}
      <section id="upcoming-payments" className="dashboard-panel scroll-mt-4 p-4 sm:p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Subscriptions and bills
              </h2>
              <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {recurring.length} active
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Scheduled bills, fixed commitments, and subscriptions (≈{" "}
              <strong className="text-foreground">{money(totalMonthlyCommitments)}</strong>/month)
            </p>
          </div>
          {canEdit && (
            <RecurringManager
              recurring={recurring}
              accounts={accounts}
              categories={categories}
              trigger={
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-xl px-3 text-xs font-semibold gap-1.5 shadow-2xs hover:bg-muted/60 cursor-pointer"
                >
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

              const date = parseISO(r.nextDate);
              const daysLeft = differenceInCalendarDays(date, today);
              const isDueSoon = !ended && daysLeft >= 0 && daysLeft <= 7;
              const isOverdue = !ended && daysLeft < 0;

              const normalizedMonth = monthlyEquivalent(r.amount, r.frequency);
              const isNonMonthly = r.frequency.toLowerCase() !== "monthly";

              return (
                <div
                  key={r.id}
                  id={`schedule-${r.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 hover:bg-muted/30 px-2 -mx-2 rounded-xl transition-colors duration-150 motion-reduce:transition-none"
                >
                  <div className="min-w-0 flex items-center gap-3">
                    <span
                      className={cn(
                        "grid size-9 shrink-0 place-items-center rounded-xl border",
                        isOverdue
                          ? "bg-negative/10 text-negative border-negative/20"
                          : isDueSoon
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                            : "bg-muted text-muted-foreground border-border/60",
                      )}
                    >
                      <Repeat className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {r.note || "Recurring " + r.type}
                        </p>
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground capitalize">
                          {r.frequency}
                        </span>
                        {isDueSoon && (
                          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                            {daysLeft === 0 ? "Due today" : `Due in ${daysLeft}d`}
                          </span>
                        )}
                        {isOverdue && (
                          <span className="rounded-full bg-negative/10 px-2 py-0.5 text-[10px] font-bold text-negative">
                            Overdue
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />
                          <span>{ended ? "Ended" : "Next: " + r.nextDate}</span>
                        </span>
                        {isNonMonthly && (
                          <span>· ≈ {money(normalizedMonth)}/mo</span>
                        )}
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
                        "amount font-mono text-sm sm:text-base font-bold tabular-nums",
                        r.type === "income" ? "text-positive" : "text-foreground",
                      )}
                    >
                      {r.type === "income" ? "+" : "−"}
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
      <section id="savings-goals" className="dashboard-panel p-4 sm:p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Savings goals
              </h2>
              <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {goals.length} target{goals.length === 1 ? "" : "s"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Long-term savings milestones and targets.
            </p>
          </div>
          {canEdit && (
            <GoalsManager
              goals={goals}
              trigger={
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-xl px-3 text-xs font-semibold gap-1.5 shadow-2xs hover:bg-muted/60 cursor-pointer"
                >
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
            const isCompleted = remaining === 0;

            return (
              <div
                key={g.id}
                className="rounded-xl border border-border/70 bg-card p-4 transition-colors duration-150 hover:border-brand/40 shadow-2xs"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-sm text-foreground truncate">
                      {g.name}
                    </span>
                    {isCompleted && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-positive/10 px-2 py-0.2 text-[10px] font-bold text-positive">
                        <CheckCircle2 className="size-3" />
                        Completed
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-xs font-bold text-brand rounded-md bg-brand/10 px-2 py-0.5">
                    {pct}%
                  </span>
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-muted my-2.5">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      isCompleted ? "bg-positive" : "bg-brand",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="flex justify-between items-baseline text-xs mt-2">
                  <span className="font-semibold text-foreground">
                    <span className="font-mono">{money(g.savedAmount)}</span>{" "}
                    <span className="font-normal text-muted-foreground text-[11px]">
                      of <span className="font-mono">{money(g.targetAmount)}</span>
                    </span>
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {Boolean(g.openingProgress)&&!g.openingReviewed&&<a href="#goal-opening-review" className="mr-2 text-brand underline">Review opening entry</a>}
                    {isCompleted ? "Goal achieved" : `${money(remaining)} remaining`}
                  </span>
                </div>
                {g.openingProgress!==undefined&&<p className="mt-1 text-xs text-muted-foreground">{money(g.reserved??0)} reserved in accounts · {money(g.outside??0)} confirmed separate savings</p>}
                {g.deadline && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Target deadline: {g.deadline}
                  </p>
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

      {/* 4. Shared Expenses Settlement Card */}
      <section id="shared-expenses" className="dashboard-panel flex scroll-mt-4 flex-col justify-between p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Shared household expenses
              </h2>
              {isSettled ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-positive/10 px-2 py-0.5 text-[10px] font-bold text-positive">
                  <CheckCircle2 className="size-3" />
                  {checkIn ? "Settled up" : "Your balances settled"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                  <AlertCircle className="size-3" />
                  Balances active
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Review who paid, who owes money, and which shared expenses are still open.
            </p>
          </div>
          <SplitManager
            data={split}
            canEdit={canEdit}
            trigger={
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-xl px-3 text-xs font-semibold gap-1.5 shadow-2xs hover:bg-muted/60 cursor-pointer"
              >
                <Handshake className="size-3.5" />
                Review shared balances
              </Button>
            }
          />
        </div>
      </section>
    </div>
  );
}
