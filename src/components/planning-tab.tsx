"use client";
import { CalendarDays, Handshake, Target } from "lucide-react";
import { BudgetsCard } from "./budgets-card";
import { RecurringManager } from "./recurring-manager";
import { GoalsManager } from "./goals-manager";
import { SplitManager } from "./split-manager";
import { Button } from "./ui/button";
import { useFormat } from "./settings-provider";
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
    <div className="space-y-6">
      <BudgetsCard
        budgets={budgets}
        categories={categories}
        canEdit={canEdit}
      />
      <section className="rounded-2xl border bg-card p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold">
              <CalendarDays className="size-[18px] text-brand" />
              Subscriptions & bills
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Scheduled income, payments and installments.
            </p>
          </div>
          {canEdit && (
            <RecurringManager
              recurring={recurring}
              accounts={accounts}
              categories={categories}
              trigger={<Button variant="outline">Manage recurring</Button>}
            />
          )}
        </div>
        <div className="divide-y">
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
                  className="flex items-center justify-between gap-4 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {r.note || "Recurring " + r.type}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {ended ? "Completed" : "Next " + r.nextDate} ·{" "}
                      {r.frequency}
                      {r.maxOccurrences !== null &&
                        " · " +
                          r.occurrenceCount +
                          "/" +
                          r.maxOccurrences +
                          " installments"}
                    </p>
                  </div>
                  <p className="shrink-0 text-right text-sm font-semibold">
                    {money(r.amount)}
                    <span className="mt-1 block text-xs font-normal text-muted-foreground">
                      {r.autoPost
                        ? "Automatic entry"
                        : "Estimate · log payment"}
                    </span>
                  </p>
                </div>
              );
            })}
          {!recurring.length && (
            <p className="py-6 text-sm text-muted-foreground">
              Add a subscription or bill to see upcoming payments here.
            </p>
          )}
        </div>
      </section>
      <section className="rounded-2xl border bg-card p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-semibold">
            <Target className="size-[18px] text-brand" />
            Savings goals
          </h2>
          {canEdit && (
            <GoalsManager
              goals={goals}
              trigger={<Button variant="outline">Manage goals</Button>}
            />
          )}
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          {goals.map((g) => (
            <div key={g.id}>
              <div className="mb-2 flex justify-between gap-3 text-sm">
                <span className="font-medium">{g.name}</span>
                <span>
                  {Math.round((g.savedAmount / g.targetAmount) * 100)}%
                </span>
              </div>
              <progress
                aria-label={g.name + " saved"}
                value={g.savedAmount}
                max={g.targetAmount}
                className="h-2 w-full accent-brand"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                {money(g.savedAmount)} of {money(g.targetAmount)}
                {g.deadline && " · by " + g.deadline}
              </p>
            </div>
          ))}
        </div>
        {!goals.length && (
          <p className="py-4 text-sm text-muted-foreground">
            Give your next milestone a name and a savings target.
          </p>
        )}
      </section>
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card p-5 sm:p-6">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <Handshake className="size-[18px] text-brand" />
            Shared expenses
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Keep track of who paid and settle up together.
          </p>
        </div>
        <SplitManager
          data={split}
          canEdit={canEdit}
          trigger={<Button variant="outline">Review shared expenses</Button>}
        />
      </section>
    </div>
  );
}
