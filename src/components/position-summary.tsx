import Link from "next/link";
import type { FinanceReport } from "@/lib/finance-position";
import { displayMoney } from "@/lib/finance-money";

export function PositionSummary({data,exportHref}:{data:FinanceReport;exportHref?:string}) {
  const p=data.position;
  return <section aria-label="Financial position" className="dashboard-panel space-y-3 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-semibold">Financial position</h2>
      {exportHref?<a href={exportHref} className="text-sm font-medium text-brand underline">Export workbook</a>:
        <Link href="/financial-position" className="text-sm font-medium text-brand underline">Open debt & currencies →</Link>}
    </div>
    {p ? <>
      <dl className="grid gap-2 sm:grid-cols-3">{[["Liquid cash",p.cash],["Debt owed",p.debt],["Net worth",p.worth]].map(([label,value])=>
        <div key={label} className="rounded-lg bg-muted/50 p-3"><dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="mt-1 font-semibold tabular-nums">{value===null?"Incomplete":displayMoney(value,data.report!)}</dd></div>)}</dl>
      {p.missing.length>0 && <p className="text-xs">Review currency, transfer legs or valuation rates for {p.missing.join(", ")}.</p>}
      <p className="text-xs text-muted-foreground">Balances by confirmed currency · {Object.entries(p.native).map(([c,n])=>displayMoney(n,c)).join(" · ")||"None reviewed"}</p>
      <p className="text-sm">All-time booked income <strong>{data.flows.missing?"Incomplete":displayMoney(data.flows.income,data.report!)}</strong> · Net spending <strong>{data.flows.missing?"Incomplete":displayMoney(data.flows.spending,data.report!)}</strong></p>
      {data.flows.missing>0 && <p className="text-xs">{data.flows.missing} historical entries need an account denomination or a booked rate.</p>}
    </>:<p className="text-sm text-muted-foreground">Review your accounts to see cash, debt and net worth in one reporting currency.</p>}
  </section>;
}
