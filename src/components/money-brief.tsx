"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { addDays, format, parseISO } from "date-fns";
import { todayISO } from "@/lib/dates";
import { useFormat } from "./settings-provider";
import type { BudgetProgressDTO, RecurringDTO } from "@/lib/queries";

export function MoneyBrief({recurring,budgets,expense,comparison,rangeLabel}: {recurring:RecurringDTO[];budgets:BudgetProgressDTO[];expense:number;comparison?:{prevIncome:number;prevExpense:number}|null;rangeLabel:string}) {
  const {money} = useFormat();
  const params = new URLSearchParams(useSearchParams().toString());
  params.set("tab","transactions"); params.set("type","expense");
  const today = todayISO();
  const end = format(addDays(parseISO(today),7),"yyyy-MM-dd");
  const due = recurring.filter(r => r.type === "expense" && r.nextDate>=today && r.nextDate<end && (!r.endDate || r.nextDate<=r.endDate) && (r.maxOccurrences === null || r.occurrenceCount<r.maxOccurrences));
  const remaining = budgets.reduce((sum,b)=>sum+b.budget-b.spent,0);
  const change = comparison && comparison.prevExpense>0 ? (expense-comparison.prevExpense)/comparison.prevExpense*100 : null;
  return <section aria-label="Your money this week" className="grid divide-y rounded-xl border bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0">
    <Link href="/?tab=planning#upcoming-payments" className="p-4 hover:bg-muted/30"><h2 className="text-xs text-muted-foreground">Due in the next 7 days</h2><p className="mt-1 text-lg font-semibold tabular-nums">{money(due.reduce((sum,r)=>sum+r.amount,0))}</p><p className="mt-1 text-xs text-muted-foreground">{due.length} scheduled {due.length===1 ? "payment" : "payments"}{due.some(r=>!r.autoPost) ? " · includes manual estimates" : ""}</p></Link>
    <Link href="/?tab=planning#monthly-budgets" className="p-4 hover:bg-muted/30"><h2 className="text-xs text-muted-foreground">Current-month budgets</h2><p className="mt-1 text-lg font-semibold tabular-nums">{budgets.length ? money(Math.abs(remaining)) : "Set a budget"}</p><p className="mt-1 text-xs text-muted-foreground">{budgets.length ? remaining<0 ? "Over combined category limits" : "Remaining across budgeted categories" : "Choose limits for the categories you track"}</p></Link>
    <Link href={`/?${params}`} className="p-4 hover:bg-muted/30"><h2 className="text-xs text-muted-foreground">Spending · {rangeLabel}</h2><p className="mt-1 text-lg font-semibold tabular-nums">{change === null ? money(expense) : `${Math.abs(change).toFixed(1)}% ${change>0 ? "higher" : change<0 ? "lower" : "change"}`}</p><p className="mt-1 text-xs text-muted-foreground">{change === null ? "Open expenses to review the details" : "Compared with the previous selected period"}</p></Link>
  </section>;
}
