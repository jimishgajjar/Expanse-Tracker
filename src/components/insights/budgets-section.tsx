"use client";

import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BudgetManager } from "@/components/budget-manager";
import { useFormat } from "@/components/settings-provider";
import { cn } from "@/lib/utils";
import { Caveat, Empty, Hero, Meter, Tile } from "@/components/insights/parts";
import type { AnalyticsData } from "@/lib/analytics";
import type { BudgetProgressDTO, CategoryDTO } from "@/lib/queries";

const monthLabel = (key: string) => format(parseISO(`${key}-01`), "MMM");
const monthLong = (key: string) => format(parseISO(`${key}-01`), "MMMM yyyy");

export function BudgetsSection({
  data,
  budgets,
  categories,
  canEdit = true,
}: {
  data: AnalyticsData;
  budgets: BudgetProgressDTO[];
  categories: CategoryDTO[];
  canEdit?: boolean;
}) {
  const { money } = useFormat();
  const b = data.budgets;
  const monthProgress = Math.round((b.dayOfMonth / b.daysInMonth) * 100);

  if (!b.items.length) {
    return (
      <Card className="gap-3">
        <CardHeader>
          <CardTitle>Budgets</CardTitle>
          {canEdit && <BudgetManager
            budgets={budgets}
            categories={categories}
            trigger={<Button size="sm" variant="outline" className="ml-auto">Set budgets</Button>}
          />}
        </CardHeader>
        <CardContent>
          <Empty>
            No budgets set yet. Add a monthly limit to a category and this tab will project where the month is heading.
          </Empty>
        </CardContent>
      </Card>
    );
  }

  const overBudget = b.totalProjected > b.totalBudget;
  const remaining = b.totalBudget - b.totalSpent;
  const dailyAllowance = b.daysInMonth > b.dayOfMonth ? remaining / (b.daysInMonth - b.dayOfMonth) : 0;
  const projectedOver = b.items.filter((i) => i.projected > i.budget);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Hero
          accent={!overBudget}
          label="Projected month-end spend"
          value={money(b.totalProjected)}
          tone={overBudget ? "text-negative" : undefined}
          note={
            <>
              against {money(b.totalBudget)} budgeted ·{" "}
              <span className={cn("font-medium", overBudget ? "text-negative" : "text-positive")}>
                {overBudget ? `${money(b.totalProjected - b.totalBudget)} over` : `${money(b.totalBudget - b.totalProjected)} spare`}
              </span>
            </>
          }
        >
          <div className="mt-3 space-y-1.5">
            <Meter pct={(b.totalProjected / (b.totalBudget || 1)) * 100} color="var(--brand)" over={overBudget} />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>{money(b.totalSpent)} spent so far</span>
              <span>day {b.dayOfMonth} of {b.daysInMonth} · {monthProgress}%</span>
            </div>
          </div>
        </Hero>

        <Hero
          label="Safe to spend per remaining day"
          value={dailyAllowance > 0 ? money(dailyAllowance) : money(0)}
          tone={dailyAllowance <= 0 ? "text-negative" : undefined}
          note={
            dailyAllowance > 0
              ? `${money(remaining)} left across ${b.daysInMonth - b.dayOfMonth} day${b.daysInMonth - b.dayOfMonth === 1 ? "" : "s"}`
              : "The month's budget is already fully committed"
          }
        />
      </div>

      <Card className="gap-3">
        <CardHeader>
          <CardTitle>Pace by category <span className="font-normal text-muted-foreground">· this month</span></CardTitle>
          {canEdit && <BudgetManager
            budgets={budgets}
            categories={categories}
            trigger={<Button size="sm" variant="outline" className="ml-auto">Manage</Button>}
          />}
        </CardHeader>
        <CardContent>
          <ul className="space-y-3.5">
            {b.items.map((i) => {
              const spentPct = (i.spent / (i.budget || 1)) * 100;
              const projPct = Math.min(100, (i.projected / (i.budget || 1)) * 100);
              const over = i.projected > i.budget;
              const alreadyOver = i.spent > i.budget;
              return (
                <li key={i.categoryId}>
                  <div className="mb-1.5 flex items-center gap-2 text-sm">
                    <Tile color={i.color} icon={i.icon} />
                    <span className="flex-1 truncate">{i.name}</span>
                    <span className={cn("amount text-xs tabular-nums", alreadyOver ? "font-medium text-negative" : "text-muted-foreground")}>
                      {money(i.spent)} / {money(i.budget)}
                    </span>
                  </div>
                  {/* Two readings on one track: solid = spent, marker = where
                      today's pace lands by month end. */}
                  <div className="relative">
                    <Meter pct={spentPct} color={i.color} over={alreadyOver} />
                    {!alreadyOver && (
                      <span
                        aria-hidden
                        className={cn("absolute top-1/2 h-3 w-px -translate-y-1/2", over ? "bg-negative" : "bg-muted-foreground/50")}
                        style={{ left: `${projPct}%` }}
                      />
                    )}
                  </div>
                  <div className="mt-1 flex justify-between text-[11px]">
                    <span className="text-muted-foreground">
                      {Math.round(spentPct)}% used
                    </span>
                    <span className={over ? "font-medium text-negative" : "text-muted-foreground"}>
                      heading for {money(i.projected)}
                      {over ? ` · ${money(i.projected - i.budget)} over` : ""}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
          <Caveat>
            Projection assumes the rest of the month continues at this month&apos;s pace so far ({money(b.totalSpent)} over {b.dayOfMonth} day
            {b.dayOfMonth === 1 ? "" : "s"}). One-off purchases early in the month will overstate it.
          </Caveat>
        </CardContent>
      </Card>

      {projectedOver.length > 0 && (
        <div className="rounded-xl border border-negative/25 bg-negative/[0.04] p-4">
          <div className="text-sm font-medium text-negative">
            {projectedOver.length} categor{projectedOver.length === 1 ? "y is" : "ies are"} on track to go over
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {projectedOver.map((i) => `${i.name} (${money(i.projected - i.budget)} over)`).join(" · ")}
          </p>
        </div>
      )}

      <BudgetHistory history={b.history} money={money} />
    </div>
  );
}

/** Actual spend per month per budgeted category, measured against today's
 *  limit. The budgets table keeps no history, so this is explicitly framed as
 *  "against today's budget" rather than pretending the limit was always this. */
function BudgetHistory({
  history,
  money,
}: {
  history: AnalyticsData["budgets"]["history"];
  money: (n: number) => string;
}) {
  if (!history.rows.length) return null;
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>Budget history <span className="font-normal text-muted-foreground">· last {history.months.length} months</span></CardTitle>
      </CardHeader>
      <CardContent>
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-2 text-left text-xs font-medium text-muted-foreground">Category</th>
                {history.months.map((m) => (
                  <th key={m} className="pb-2 text-right text-xs font-medium text-muted-foreground">{monthLabel(m)}</th>
                ))}
                <th className="pb-2 text-right text-xs font-medium text-muted-foreground">Budget</th>
              </tr>
            </thead>
            <tbody>
              {history.rows.map((r) => (
                <tr key={r.categoryId} className="border-b border-border last:border-0">
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <Tile color={r.color} icon={r.icon} size={20} />
                      <span className="truncate">{r.name}</span>
                    </div>
                  </td>
                  {r.values.map((v, i) => {
                    const over = v > r.budget;
                    return (
                      <td
                        key={history.months[i]}
                        title={`${r.name} · ${monthLong(history.months[i])} · ${money(v)}`}
                        className={cn(
                          "amount py-2 text-right text-xs tabular-nums",
                          v === 0 ? "text-muted-foreground/50" : over ? "font-medium text-negative" : "text-muted-foreground",
                        )}
                      >
                        {v === 0 ? "—" : money(v)}
                      </td>
                    );
                  })}
                  <td className="amount py-2 text-right text-xs font-medium tabular-nums">{money(r.budget)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Caveat>
          Past months are compared against your <em>current</em> budget — the app stores one limit per category, not a history of
          limits. Red means that month&apos;s actual spend exceeded today&apos;s limit.
        </Caveat>
      </CardContent>
    </Card>
  );
}
