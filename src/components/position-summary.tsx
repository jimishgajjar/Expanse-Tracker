import Link from "next/link";
import { ArrowRight, Scale } from "lucide-react";
import type { FinanceReport } from "@/lib/finance-position";
import { displayMoney } from "@/lib/finance-money";

export function PositionSummary({data,exportHref}:{data:FinanceReport;exportHref?:string}) {
  const p=data.position;
  if (!p && !exportHref) {
    // Not set up yet: a quiet one-line invitation instead of a full panel.
    return <Link href="/financial-position" aria-label="Financial position: set up debt and currencies"
      className="group flex items-center gap-3 rounded-xl border border-dashed border-border bg-card/60 px-4 py-3 text-sm transition-colors hover:border-brand/40 hover:bg-card">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground group-hover:text-brand"><Scale className="size-4" aria-hidden/></span>
      <span className="min-w-0 flex-1"><strong className="block font-medium text-foreground">See debt and net worth in one currency</strong>
        <span className="block text-xs text-muted-foreground">Review each account once to combine cash, cards and loans.</span></span>
      <span className="hidden items-center gap-1 text-xs font-medium text-brand sm:inline-flex">Set up <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden/></span>
    </Link>;
  }
  return <section aria-label="Financial position" className="dashboard-panel space-y-3 p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-semibold">Financial position</h2>
      {exportHref?<a href={exportHref} className="text-link text-sm">Export workbook</a>:
        <Link href="/financial-position" className="text-link text-sm">Debt & currencies →</Link>}
    </div>
    {p ? <>
      <dl className="grid gap-2 sm:grid-cols-3">{[["Liquid cash",p.cash],["Debt owed",p.debt],["Net worth",p.worth]].map(([label,value])=>
        <div key={label} className="rounded-lg bg-muted/50 p-3"><dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="amount mt-1 text-lg font-semibold">{value===null?"Incomplete":displayMoney(value,data.report!)}</dd></div>)}</dl>
      {p.missing.length>0 && <p className="text-xs">Review currency, transfer legs or valuation rates for {p.missing.join(", ")}.</p>}
      <p className="text-xs text-muted-foreground">Balances by confirmed currency · {Object.entries(p.native).map(([c,n])=>displayMoney(n,c)).join(" · ")||"None reviewed"}</p>
      <p className="text-sm">All-time booked income <strong className="amount">{data.flows.missing?"Incomplete":displayMoney(data.flows.income,data.report!)}</strong> · Net spending <strong className="amount">{data.flows.missing?"Incomplete":displayMoney(data.flows.spending,data.report!)}</strong></p>
      {data.flows.missing>0 && <p className="text-xs">{data.flows.missing} historical entries need an account denomination or a booked rate.</p>}
    </>:<p className="text-sm text-muted-foreground">Confirm each account below to see cash, debt and net worth in one reporting currency.</p>}
  </section>;
}
