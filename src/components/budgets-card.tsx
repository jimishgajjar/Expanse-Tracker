"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icon";
import { BudgetManager } from "@/components/budget-manager";
import { useFormat } from "@/components/settings-provider";
import { cn } from "@/lib/utils";
import type { BudgetProgressDTO, CategoryDTO } from "@/lib/queries";

export function BudgetsCard({ budgets, categories }: { budgets: BudgetProgressDTO[]; categories: CategoryDTO[] }) {
  const { money } = useFormat();
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>Budgets <span className="font-normal text-muted-foreground">· this month</span></CardTitle>
        <BudgetManager
          budgets={budgets}
          categories={categories}
          trigger={<Button size="sm" variant="outline" className="ml-auto">Manage</Button>}
        />
      </CardHeader>
      <CardContent>
        {budgets.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No budgets set — tap Manage to add monthly limits.</p>
        ) : (
          <ul className="space-y-3">
            {budgets.map((b) => {
              const pct = Math.min(100, Math.round((b.spent / b.budget) * 100));
              const over = b.spent > b.budget;
              return (
                <li key={b.categoryId}>
                  <div className="mb-1 flex items-center gap-2 text-sm">
                    <span className="grid size-6 shrink-0 place-items-center rounded" style={{ backgroundColor: `${b.color}22`, color: b.color }}>
                      <Icon name={b.icon} size={13} />
                    </span>
                    <span className="flex-1 truncate">{b.name}</span>
                    <span className={cn("font-mono text-xs", over ? "font-medium text-negative" : "text-muted-foreground")}>
                      {money(b.spent)} / {money(b.budget)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: over ? "var(--negative)" : b.color }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
