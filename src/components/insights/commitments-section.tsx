"use client";

import { useMemo } from "react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RecurringManager } from "@/components/recurring-manager";
import { useFormat } from "@/components/settings-provider";
import { cn } from "@/lib/utils";
import { Caveat, Empty, Hero, Meter, Tile } from "@/components/insights/parts";
import { commitmentTotals, perMonth, priceChange } from "@/lib/commitments";
import { todayISO } from "@/lib/dates";
import type { AnalyticsData } from "@/lib/analytics";
import type { AccountDTO, CategoryDTO, RecurringDTO } from "@/lib/queries";

/** How far ahead the "due next" list looks. */
const HORIZON_DAYS = 30;

export function CommitmentsSection({
  data,
  recurring,
  accounts,
  categories,
  canEdit,
}: {
  data: AnalyticsData;
  recurring: RecurringDTO[];
  accounts: AccountDTO[];
  categories: CategoryDTO[];
  canEdit: boolean;
}) {
  const { money } = useFormat();
  const today = todayISO();
  const t = useMemo(() => commitmentTotals(recurring, today), [recurring, today]);

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const accById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  // Typical monthly income from the months that actually had any — averaging in
  // empty months would understate income and inflate the committed share.
  const earning = data.monthly.filter((m) => m.income > 0);
  const avgIncome = earning.length ? earning.reduce((s, m) => s + m.income, 0) / earning.length : 0;
  const committedShare = avgIncome > 0 ? Math.round((t.monthly / avgIncome) * 100) : null;

  const manage = (label: string) =>
    canEdit ? (
      <RecurringManager
        recurring={recurring}
        accounts={accounts}
        categories={categories}
        trigger={<Button size="sm" variant="outline" className="ml-auto">{label}</Button>}
      />
    ) : null;

  if (!t.expenses.length) {
    return (
      <Card className="gap-3">
        <CardHeader>
          <CardTitle>Commitments</CardTitle>
          {manage("Add a subscription")}
        </CardHeader>
        <CardContent>
          <Empty>
            No active subscriptions, bills or EMIs. Add one and this tab will show what it costs you a month and a year.
          </Empty>
        </CardContent>
      </Card>
    );
  }

  const upcoming = t.expenses
    .map((r) => ({ rule: r, days: differenceInCalendarDays(parseISO(r.nextDate), parseISO(today)) }))
    .filter((u) => u.days >= 0 && u.days <= HORIZON_DAYS)
    .sort((a, b) => a.days - b.days);
  const dueSoonTotal = upcoming.reduce((s, u) => s + u.rule.amount, 0);

  const repriced = t.expenses
    .map((r) => ({ rule: r, change: priceChange(r) }))
    .filter((x): x is { rule: RecurringDTO; change: NonNullable<ReturnType<typeof priceChange>> } => x.change !== null)
    .sort((a, b) => Math.abs(b.change.pct) - Math.abs(a.change.pct));

  const maxKind = Math.max(1, ...t.byKind.map((g) => g.monthly));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Hero
          accent
          label="Committed every month"
          value={money(t.monthly)}
          note={
            <>
              {money(t.yearly)} a year across {t.expenses.length} active commitment{t.expenses.length === 1 ? "" : "s"}
            </>
          }
        >
          {committedShare !== null && (
            <div className="mt-3 space-y-1.5">
              <Meter pct={committedShare} color="var(--brand)" over={committedShare > 100} />
              <div className="text-[11px] text-muted-foreground">
                <span className={cn("font-medium", committedShare > 50 ? "text-negative" : "text-foreground")}>{committedShare}%</span>{" "}
                of typical monthly income ({money(avgIncome)})
              </div>
            </div>
          )}
        </Hero>

        <Hero
          label={`Due in the next ${HORIZON_DAYS} days`}
          value={money(dueSoonTotal)}
          note={
            upcoming.length
              ? `${upcoming.length} charge${upcoming.length === 1 ? "" : "s"} scheduled`
              : "Nothing scheduled in this window"
          }
        />
      </div>

      <Card className="gap-3">
        <CardHeader>
          <CardTitle>Where the commitment sits</CardTitle>
          {manage("Manage")}
        </CardHeader>
        <CardContent>
          <ul className="space-y-3.5">
            {t.byKind.map((g) => (
              <li key={g.kind}>
                <div className="mb-1 flex items-baseline gap-2 text-sm">
                  <span className="flex-1 truncate">{g.label}</span>
                  <span className="text-[11px] text-muted-foreground">{g.rules.length}×</span>
                  <span className="amount w-24 text-right text-xs font-medium tabular-nums">{money(g.monthly)}<span className="text-muted-foreground">/mo</span></span>
                </div>
                <Meter pct={(g.monthly / maxKind) * 100} color="var(--brand)" />
              </li>
            ))}
          </ul>
          {t.monthlyIncome > 0 && (
            <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
              Recurring income of <span className="amount font-medium text-positive tabular-nums">{money(t.monthlyIncome)}/mo</span> is
              tracked separately and not netted off the figures above.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="gap-3">
        <CardHeader>
          <CardTitle>Every commitment <span className="font-normal text-muted-foreground">· by monthly cost</span></CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {[...t.expenses]
              .sort((a, b) => perMonth(b.amount, b.frequency) - perMonth(a.amount, a.frequency))
              .map((r) => {
                const cat = r.categoryId ? catById.get(r.categoryId) : undefined;
                const acc = r.accountId ? accById.get(r.accountId) : undefined;
                const mo = perMonth(r.amount, r.frequency);
                const change = priceChange(r);
                const days = differenceInCalendarDays(parseISO(r.nextDate), parseISO(today));
                return (
                  <li key={r.id} className="flex items-center gap-3 py-2.5">
                    <Tile color={cat?.color ?? "#9b9a97"} icon={cat?.icon ?? "repeat"} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">
                        {r.note || cat?.name || "Recurring payment"}
                        {!r.autoPost && <span className="ml-1.5 text-[11px] text-muted-foreground">est.</span>}
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {r.frequency} · next {format(parseISO(r.nextDate), "d MMM")}
                        {days >= 0 && days <= 3 ? ` · ${days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`}` : ""}
                        {acc ? ` · ${acc.name}` : ""}
                      </div>
                    </div>
                    <div className="w-28 shrink-0 text-right">
                      <div className="amount text-sm font-medium tabular-nums">{money(mo)}<span className="text-[11px] font-normal text-muted-foreground">/mo</span></div>
                      {change && change.pct !== 0 && (
                        <div className={cn("text-[11px] font-medium tabular-nums", change.pct > 0 ? "text-negative" : "text-positive")}>
                          {change.pct > 0 ? "▲" : "▼"} {Math.abs(change.pct)}% since start
                        </div>
                      )}
                      {r.frequency !== "monthly" && (
                        <div className="text-[11px] text-muted-foreground">{money(r.amount)} {r.frequency}</div>
                      )}
                    </div>
                  </li>
                );
              })}
          </ul>
          {t.estimated.length > 0 && (
            <Caveat>
              {t.estimated.length} commitment{t.estimated.length === 1 ? " is" : "s are"} marked <em>remind to log</em> — their amounts are
              your estimates, not confirmed charges, so the monthly total is approximate.
            </Caveat>
          )}
        </CardContent>
      </Card>

      {repriced.length > 0 && (
        <Card className="gap-3">
          <CardHeader>
            <CardTitle>Price changes</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {repriced.map(({ rule, change }) => {
                const cat = rule.categoryId ? catById.get(rule.categoryId) : undefined;
                return (
                  <li key={rule.id} className="flex items-center gap-3 py-2.5">
                    <Tile color={cat?.color ?? "#9b9a97"} icon={cat?.icon ?? "repeat"} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{rule.note || cat?.name || "Recurring payment"}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {change.changes} change{change.changes === 1 ? "" : "s"} logged
                      </div>
                    </div>
                    <div className="amount shrink-0 text-right text-xs tabular-nums">
                      <span className="text-muted-foreground line-through">{money(change.original)}</span>
                      <span className="mx-1.5 text-muted-foreground">→</span>
                      <span className="font-medium">{money(change.current)}</span>
                      <div className={cn("text-[11px] font-medium", change.pct > 0 ? "text-negative" : "text-positive")}>
                        {change.pct > 0 ? "+" : "−"}{Math.abs(change.pct)}%
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <Caveat>
              Compares each commitment&apos;s current amount with the first amount recorded for it. Only changes made through the
              Subscriptions editor are logged.
            </Caveat>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
