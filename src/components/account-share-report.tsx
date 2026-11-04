"use client";
import Image from "next/image";
import { useState } from "react";
import type { AccountReport, ReportLine } from "@/lib/account-share-store";
import { Button } from "./ui/button";

function money(amount: string, currency: string) {
  const [whole, fraction = "00"] = amount.split(".");
  return currency + " " + whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "." + fraction;
}

function ReportPhoto({ src }: { src: string }) {
  const [open,setOpen] = useState(false);
  const [failed,setFailed] = useState(false);
  return <div><button type="button" className="text-xs text-brand underline" aria-expanded={open} onClick={() => setOpen(!open)}>
    {open ? "Hide receipt" : "View receipt photo"}
  </button>
    {open && (failed ? <p className="text-xs text-muted-foreground">The original photo is no longer available.</p>
      : <Image src={src} unoptimized width={360} height={420} alt="Receipt for this entry" className="mt-2 max-h-72 w-auto rounded-md object-contain" onError={() => setFailed(true)} />)}
  </div>;
}

export function AccountShareReport({ report, photoUrl }: { report: AccountReport; photoUrl: (line:ReportLine) => string }) {
  const [page,setPage] = useState(0);
  const count = report.lines.length;
  const pageCount = Math.max(1,Math.ceil(count/25));
  return <section className="space-y-4" aria-label="Account report">
    <div className="rounded-xl border bg-card p-4">
      <h2 className="font-semibold">{report.name}</h2>
      <p className="mt-1 text-xs text-muted-foreground">Balance in this copy</p>
      <p className="text-xl font-semibold tabular-nums">{money(report.balance,report.currency)}</p>
      <p className="mt-2 text-xs text-muted-foreground">Opening balance {money(report.opening,report.currency)} · {count} entries · {report.lines.filter(l => l.photo).length} receipt photos</p>
    </div>
    {count === 0 ? <p className="text-sm">This account has no activity.</p> : <ol className="divide-y rounded-xl border bg-card px-4">
      {report.lines.slice(page*25,(page+1)*25).map((line,i) => <li key={page*25+i} className="py-2 text-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><span className="block break-words font-medium">{line.note || line.category || line.kind}</span>
            <span className="text-xs text-muted-foreground">{line.date} · {line.kind}{line.note && line.category && " · "+line.category}</span></div>
          <span className="shrink-0 tabular-nums">{line.kind==="expense" || line.kind==="transfer out" ? "−" : "+"}{money(line.amount,report.currency)}</span>
        </div>
        {line.photo && <ReportPhoto key={line.photo} src={photoUrl(line)} />}
      </li>)}
    </ol>}
    {pageCount>1 && <div className="flex items-center justify-between gap-2 text-xs">
      <Button variant="outline" size="sm" disabled={page===0} onClick={()=>setPage(page-1)}>Previous</Button>
      Page {page+1} of {pageCount}
      <Button variant="outline" size="sm" disabled={page+1===pageCount} onClick={()=>setPage(page+1)}>Next</Button>
    </div>}
  </section>;
}
