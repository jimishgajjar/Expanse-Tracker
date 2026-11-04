"use client";

import { parseISO } from "date-fns";
import { ArrowDown, CalendarDays, Handshake, Target, type LucideIcon } from "lucide-react";
import type { WeeklyHouseholdCheckIn } from "@/lib/weekly-household";
import { useFormat, useSettings } from "./settings-provider";

type Row = { id: string; label: string; value: string; detail?: string };

function CheckInColumn({ title, icon: Icon, rows, empty, link, href, note }: {
  title: string; icon: LucideIcon; rows: Row[]; empty: string; link: string; href: string; note?: string;
}) {
  const renderRow = (row: Row) => (
    <li key={row.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2 py-1.5 text-xs">
      <span className="break-words font-medium">{row.label}</span>
      <span className="text-right font-semibold tabular-nums">{row.value}</span>
      {row.detail && <span className="col-span-2 text-[11px] text-muted-foreground">{row.detail}</span>}
    </li>
  );
  return (
    <section className="flex min-w-0 flex-col gap-1.5 px-4 py-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Icon aria-hidden="true" className="size-4 shrink-0 text-brand" />{title}
        <span className="ml-auto rounded-md bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{rows.length}</span>
      </h3>
      {rows.length > 0 ? <ul className="divide-y divide-border/50">{rows.slice(0, 3).map(renderRow)}</ul>
        : <p className="py-1.5 text-xs text-muted-foreground">{empty}</p>}
      {rows.length > 3 && <details className="group">
        <summary className="w-fit cursor-pointer rounded text-xs font-medium text-brand focus-visible:outline-2">
          <span className="group-open:hidden">Show {rows.length - 3} more</span><span className="hidden group-open:inline">Show fewer</span>
          <span className="sr-only"> in {title.toLowerCase()}</span>
        </summary>
        <ul className="divide-y divide-border/50">{rows.slice(3).map(renderRow)}</ul>
      </details>}
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      <a className="mt-auto inline-flex w-fit items-center gap-1 rounded py-1 text-xs font-semibold text-brand hover:underline focus-visible:outline-2" href={href}>
        {link}<ArrowDown aria-hidden="true" className="size-3" />
      </a>
    </section>
  );
}

export function HouseholdCheckIn({ review }: { review: WeeklyHouseholdCheckIn }) {
  const { money } = useFormat();
  const { locale } = useSettings();
  const dates = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" });
  const displayDate = (day: string) => dates.format(parseISO(day));
  const dateRange = dates.formatRange(parseISO(review.today), parseISO(review.through));
  const goalRows = review.goals.map(goal => {
    const remaining = (Math.round(goal.targetAmount * 100) - Math.round(goal.savedAmount * 100)) / 100;
    const deadline = goal.deadline === review.today ? "Target today" : goal.deadline
      ? (goal.deadline < review.today ? "Target was " : "Target ") + displayDate(goal.deadline) : "";
    const detail = [`${money(goal.savedAmount)} saved`, deadline, goal.openingProgress && !goal.openingReviewed ? "Opening amount needs review" : ""]
      .filter(Boolean).join(" · ");
    return { id: goal.id, label: goal.name, value: `${money(remaining)} to go`, detail };
  });

  return (
    <section id="weekly-check-in" aria-labelledby="weekly-check-in-title" className="dashboard-panel scroll-mt-4 overflow-hidden">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border/60 px-4 py-3">
        <h2 id="weekly-check-in-title" className="text-base font-semibold tracking-tight">Weekly household check-in</h2>
        <p className="text-xs text-muted-foreground">Bill dates · {dateRange}</p>
      </header>
      <div className="grid divide-y divide-border/60 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        <CheckInColumn title="Outstanding reimbursements" icon={Handshake} link="Review shared expenses" href="#shared-expenses"
          empty="No reimbursements outstanding." rows={review.reimbursements.map(pair => ({ id: pair.key, label: pair.label, value: money(pair.amount) }))} />
        <CheckInColumn title="Upcoming bills" icon={CalendarDays} link="Review bill schedules" href="#upcoming-payments"
          empty="No bills scheduled in the next 7 days."
          note={review.pastSchedules ? `${review.pastSchedules} past schedule ${review.pastSchedules === 1 ? "date needs" : "dates need"} review.` : undefined}
          rows={review.bills.map(bill => ({ id: bill.id, label: bill.note || "Recurring payment", value: money(bill.amount),
            detail: [bill.nextDate === review.today ? "Today" : displayDate(bill.nextDate), bill.autoPost ? "Scheduled" : "Estimated amount"].join(" · ") }))} />
        <CheckInColumn title="Savings goals" icon={Target} link="Review savings goals" href="#savings-goals" rows={goalRows}
          empty={review.completedGoals ? "All savings goals have reached their targets." : "No household savings goals yet."} />
      </div>
    </section>
  );
}
