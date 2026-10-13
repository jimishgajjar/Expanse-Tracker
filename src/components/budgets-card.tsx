"use client";

import Link from "next/link";
import { ChevronRight, SlidersHorizontal, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icon";
import { BudgetManager } from "@/components/budget-manager";
import { useFormat } from "@/components/settings-provider";
import { cn } from "@/lib/utils";
import type { BudgetProgressDTO, CategoryDTO } from "@/lib/queries";

export function BudgetsCard({
  budgets,
  categories,
  canEdit = true,
}: {
  budgets: BudgetProgressDTO[];
  categories: CategoryDTO[];
  canEdit?: boolean;
}) {
  const { money } = useFormat();

  const totalBudget = budgets.reduce((s, b) => s + b.budget, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
  const totalPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
  const overBudgetCount = budgets.filter((b) => b.spent > b.budget).length;

  return (
    <div className="dashboard-panel p-4 sm:p-5">
      {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4 mb-5">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              Category Budgets
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Total spent: <span className="font-mono font-semibold text-foreground">{money(totalSpent)}</span> of{" "}
              <span className="font-mono font-semibold text-foreground">{money(totalBudget)}</span> ({totalPct}%)
            </p>
          </div>

          <div className="flex items-center gap-2">
            {overBudgetCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-negative/10 px-2.5 py-1 text-xs font-bold text-negative ring-1 ring-negative/25">
                <ShieldAlert className="size-3.5" />
                {overBudgetCount} exceeded
              </span>
            )}
            {canEdit && (
              <BudgetManager
                budgets={budgets}
                categories={categories}
                trigger={
                  <Button variant="outline" size="sm" className="h-9 rounded-xl px-3 text-xs font-semibold gap-1.5 shadow-2xs hover:border-brand/40">
                    <SlidersHorizontal className="size-3.5" />
                    Manage limits
                  </Button>
                }
              />
            )}
          </div>
        </div>

        {/* Content */}
        {budgets.length === 0 ? (
          <div className="py-10 text-center">
            <div className="mx-auto mb-3 grid size-10 place-items-center rounded-2xl bg-brand/10 text-brand ring-1 ring-brand/20">
              <ShieldCheck className="size-5" />
            </div>
            <h3 className="text-sm font-bold text-foreground">No monthly budgets configured</h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
              Set monthly spending targets on your categories to track pace, get automated telemetry warnings, and safeguard your savings.
            </p>
            {canEdit && (
              <div className="mt-4">
                <BudgetManager
                  budgets={budgets}
                  categories={categories}
                  trigger={
                    <Button size="sm" className="rounded-xl font-semibold">
                      Set first budget
                    </Button>
                  }
                />
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {budgets.map((b) => {
              const pct = b.budget > 0 ? Math.round((b.spent / b.budget) * 100) : 0;
              const over = b.spent > b.budget;
              const remaining = b.budget - b.spent;

              return (
                <div
                  key={b.categoryId}
                  className="group/item flex flex-col justify-between rounded-2xl border border-border/60 bg-muted/20 hover:bg-muted/40 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/35"
                >
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <Link
                      href={`/categories/${b.categoryId}`}
                      className="flex items-center gap-2.5 min-w-0 hover:opacity-85 transition-opacity"
                    >
                      <span
                        className="grid size-8 shrink-0 place-items-center rounded-xl transition-transform group-hover/item:scale-105 shadow-2xs"
                        style={{ backgroundColor: `${b.color}1c`, color: b.color }}
                      >
                        <Icon name={b.icon} size={15} />
                      </span>
                      <span className="font-bold text-sm text-foreground truncate group-hover/item:text-brand transition-colors">
                        {b.name}
                      </span>
                      <ChevronRight className="size-3 text-muted-foreground opacity-60 group-hover/item:opacity-100 group-hover/item:translate-x-0.5 transition-all" />
                    </Link>

                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ring-1 shrink-0",
                        over
                          ? "bg-negative/10 text-negative ring-negative/25"
                          : pct >= 80
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/25"
                            : "bg-muted text-muted-foreground ring-border/80",
                      )}
                    >
                      {pct}%
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-baseline text-xs">
                      <span className="font-mono text-xs font-bold text-foreground">
                        {money(b.spent)}{" "}
                        <span className="font-normal text-[11px] text-muted-foreground">
                          / {money(b.budget)}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "font-mono text-[11px] font-semibold",
                          over ? "text-negative" : "text-muted-foreground",
                        )}
                      >
                        {over ? `-${money(Math.abs(remaining))} over` : `${money(remaining)} left`}
                      </span>
                    </div>

                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted/80 shadow-2xs">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          over ? "bg-negative" : pct >= 80 ? "bg-amber-500" : "bg-brand",
                        )}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}
