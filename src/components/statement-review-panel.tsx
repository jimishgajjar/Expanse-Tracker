"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, RefreshCw, Scale, AlertCircle } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { todayISO } from "@/lib/dates";
import { analyseStatement, type ReviewChoice, type StatementReview } from "@/lib/statement-review";
import { loadReview, savedReviews, saveReview, startReview } from "@/lib/statement-review-actions";
import { StatementCorrection } from "./statement-correction";

type Summary = Omit<StatementReview,"snapshot"|"decisions"|"entryChanges"|"omittedChanges">;
const statusLabel = {draft:"In progress",completed:"Completed",needs_review:"Needs review"};
export function StatementReviewPanel({accountId,accountName,canEdit,correctionsEnabled,initialReviews}:{accountId:string;accountName:string;canEdit:boolean;correctionsEnabled:boolean;initialReviews:Summary[]}) {
  const [reviews,setReviews] = useState(initialReviews);
  const [review,setReview] = useState<StatementReview|null>(null);
  const [start,setStart] = useState(()=>`${todayISO().slice(0,7)}-01`);
  const [end,setEnd] = useState(todayISO);
  const [closing,setClosing] = useState("");
  const [decisions,setDecisions] = useState<Record<string,ReviewChoice>>({});
  const [duplicatesReviewed,setDuplicatesReviewed] = useState(false);
  const [filter,setFilter] = useState("all");
  const [page,setPage] = useState(0);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const working = useRef(false), requestId = useRef<string|null>(null);
  const analysis = review ? analyseStatement(review.snapshot,review.start,review.end,review.closingBalance,decisions,duplicatesReviewed) : null;
  const editable = canEdit && review?.status==="draft" && review.effectiveStatus!=="needs_review";
  const choicesSaved = !!review && duplicatesReviewed===review.duplicatesReviewed &&
    Object.keys(decisions).length===Object.keys(review.decisions).length &&
    Object.entries(decisions).every(([id,choice])=>review.decisions[id]===choice);
  const duplicateIds = new Set(analysis?.duplicateIds ?? []);
  const rows = analysis?.entries.filter(entry=>filter==="all" || (filter==="duplicates" ? duplicateIds.has(entry.id) : filter==="unreviewed" ? !decisions[entry.id] : decisions[entry.id]===filter)) ?? [];
  const activePage = Math.min(page,Math.max(0,Math.ceil(rows.length/25)-1));
  const amount = (value:string) => `${review?.snapshot.currency ?? ""} ${value.replace(/\B(?=(\d{3})+(?!\d))/g,",")}`;
  function select(value:StatementReview) {
    setReview(value); setDecisions(value.decisions);setDuplicatesReviewed(value.duplicatesReviewed);setPage(0);setFilter("all");
  }
  async function refresh() {
    const result = await savedReviews(accountId);
    if (result.ok) setReviews(result.reviews); else throw new Error(result.error);
  }
  async function run(action:()=>Promise<void>) {
    if (working.current) return;
    working.current=true;setBusy(true);setMessage("");
    try { await action(); } catch(error) { setMessage(error instanceof Error ? error.message : "Could not confirm the review. Reload saved reviews before retrying."); }
    finally {working.current=false;setBusy(false);}
  }
  async function open(id:string) {
    const result = await loadReview(id);
    if (!result.ok) throw new Error(result.error);
    select(result.review);
  }
  async function save(complete:boolean) {
    if (!review) return;
    const result=await saveReview({id:review.id,version:review.version,decisions,duplicatesReviewed,complete});
    if (!result.ok) throw new Error(result.error);
    select(result.review); await refresh();setMessage(complete?"Statement review completed. Your ledger was not changed.":"Review choices saved.");
  }
  return <div className="space-y-5">
    <Link href={`/accounts/${accountId}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3"/>Back to {accountName}</Link>
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-xl font-semibold tracking-tight">Statement review</h1><p className="mt-1 max-w-xl text-sm text-muted-foreground">Compare your statement with {accountName}. Mark the entries that cleared. Saving a review does not change your balance.</p></div>
      {review && canEdit && <Button variant="outline" disabled={busy} onClick={()=>{setReview(null);requestId.current=null;setMessage("");}}>New review</Button>}
    </header>
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_270px]">
      <div className="min-w-0 space-y-4">
        {message && <p role="status" className="rounded-lg border bg-muted/40 p-3 text-sm">{message}</p>}
        {!review ? <form className="dashboard-panel space-y-4 p-5" onSubmit={event=>{event.preventDefault();void run(async()=>{
          requestId.current ??= crypto.randomUUID();
          const result=await startReview({id:requestId.current,accountId,start,end,closingBalance:closing});
          if (!result.ok) throw new Error(result.error);
          select(result.review);requestId.current=null;await refresh();
        });}}>
          <div className="flex items-center gap-2"><Scale className="size-4 text-brand"/><h2 className="text-sm font-semibold">Start with your statement</h2></div>
          <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="statement-start">First date</Label><Input id="statement-start" type="date" required value={start} disabled={busy||!canEdit} onChange={e=>setStart(e.target.value)}/></div>
            <div className="space-y-1.5"><Label htmlFor="statement-end">Closing date</Label><Input id="statement-end" type="date" required value={end} disabled={busy||!canEdit} onChange={e=>setEnd(e.target.value)}/></div></div>
          <div className="space-y-1.5"><Label htmlFor="statement-closing">Statement closing balance</Label><Input id="statement-closing" inputMode="decimal" placeholder="0.00" required value={closing} disabled={busy||!canEdit} onChange={e=>setClosing(e.target.value)}/><p className="text-xs text-muted-foreground">Use the signed balance and currency of this account. Two decimal places; no currency conversion.</p></div>
          <p className="text-xs leading-relaxed text-muted-foreground">The starting balance includes all earlier ledger activity. Confirm it against the statement opening balance. “Outstanding” means an entry exists in your ledger but has not posted on this statement.</p>
          <Button type="submit" disabled={busy||!canEdit}>{busy?"Starting…":"Start review"}</Button>
          {!canEdit && <p className="text-xs text-muted-foreground">You can read saved reviews. An editor must start or complete one.</p>}
        </form> : analysis && <>
          <section className="dashboard-panel space-y-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-semibold">{review.start} — {review.end}</h2><p className="mt-1 text-xs text-muted-foreground">Started by {review.actorName} · {statusLabel[review.effectiveStatus]}</p></div><Button size="sm" variant="ghost" disabled={busy} onClick={()=>void run(()=>open(review.id))}><RefreshCw className="size-3.5"/>Reload saved</Button></div>
            {review.changes.length>0 && <div role="alert" className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm"><p className="flex items-center gap-2 font-medium"><AlertCircle className="size-4"/>This review needs attention</p>{review.changes.map(change=><p key={change}>{change}</p>)}<p>These are the originally reviewed values. Start a new review to check the current ledger; this evidence is retained.</p></div>}
            {review.effectiveStatus==="completed" && <p className="flex items-center gap-2 text-sm text-positive"><CheckCircle2 className="size-4"/>Completed with an exact match. Later ledger changes are checked whenever this review is loaded.</p>}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs"><dt className="text-muted-foreground">Starting ledger balance</dt><dd className="text-right font-mono">{amount(analysis.opening)}</dd><dt className="text-muted-foreground">Statement closing balance</dt><dd className="text-right font-mono">{amount(review.closingBalance)}</dd><dt className="text-muted-foreground">Starting balance + cleared entries</dt><dd className="text-right font-mono">{amount(analysis.clearedClosing)}</dd><dt className="text-muted-foreground">Outstanding movement (excluded)</dt><dd className="text-right font-mono">{amount(analysis.outstanding)}</dd><dt className="text-muted-foreground">Ledger balance when reviewed</dt><dd className="text-right font-mono">{amount(analysis.ledgerClosing)}</dd><dt className="border-t pt-2 font-semibold">{review.effectiveStatus==="needs_review" ? "Original difference" : "Difference to explain"}</dt><dd className="border-t pt-2 text-right font-mono font-semibold">{amount(analysis.difference)}</dd></dl>
          </section>
          {review.entryChanges.length>0&&<details className="dashboard-panel p-4 text-sm">
            <summary className="cursor-pointer font-semibold">See which entries changed ({review.entryChanges.length+review.omittedChanges})</summary>
            <ul className="mt-2 divide-y">{review.entryChanges.map(({before,after})=><li key={before?.id??after?.id} className="space-y-1 py-2">
              <strong>{before&&after?"Changed":after?"Entered this review":"Left this review"}</strong>
              {([["When reviewed",before],["In the ledger now",after]] as const).map(([label,e])=>e&&<p key={label}>{label}: {e.date} · {e.note||e.kind} · {e.kind} · {e.delta}</p>)}
              {before&&after&&(before.fromAccountId!==after.fromAccountId||before.toAccountId!==after.toAccountId)&&<p>The transfer accounts changed.</p>}
            </li>)}</ul>
            {review.omittedChanges>0&&<p>Showing the first {review.entryChanges.length} changes.</p>}
          </details>}
          {review.effectiveStatus==="needs_review"&&canEdit&&<Button variant="outline" disabled={busy} onClick={()=>{
            setStart(review.start);setEnd(review.end);setClosing(review.closingBalance);setReview(null);setMessage("");requestId.current=null;
          }}>Start fresh with these statement details</Button>}
          <section className="dashboard-panel overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3"><div><h3 className="text-sm font-semibold">Review statement entries</h3><p className="text-xs text-muted-foreground">{analysis.unreviewed} unreviewed · {analysis.entries.length} entries</p></div><select aria-label="Review entry filter" value={filter} onChange={e=>{setFilter(e.target.value);setPage(0);}} className="h-9 rounded-lg border bg-background px-2 text-xs"><option value="all">All entries</option><option value="unreviewed">Unreviewed</option><option value="cleared">Cleared</option><option value="outstanding">Outstanding</option><option value="duplicates">Possible duplicates</option></select></div>
            <ul className="divide-y">{rows.slice(activePage*25,(activePage+1)*25).map(entry=><li key={entry.id} className="flex flex-wrap items-center gap-3 px-3 py-3"><div className="min-w-0 flex-1 basis-40"><p className="break-words text-sm font-medium">{entry.note||entry.kind}</p><p className="text-xs text-muted-foreground">{entry.date} · {entry.kind}{duplicateIds.has(entry.id)?" · Possible duplicate":""}</p></div><span className="text-xs font-mono tabular-nums">{amount(entry.delta)}</span><select aria-label={`Review ${entry.note||entry.kind} on ${entry.date} (${entry.id})`} disabled={busy||!editable} value={decisions[entry.id]??""} onChange={e=>{const choice=e.target.value;setDecisions(previous=>{const next={...previous};if(choice)next[entry.id]=choice as ReviewChoice;else delete next[entry.id];return next;});}} className="h-9 max-w-full rounded-lg border bg-background px-2 text-xs"><option value="">Unreviewed</option><option value="cleared">Cleared on statement</option><option value="outstanding">Outstanding</option></select></li>)}</ul>
            {rows.length===0 && <p className="p-4 text-sm text-muted-foreground">No entries in this view.</p>}
            {rows.length>25 && <div className="flex items-center justify-between border-t p-3 text-xs"><Button variant="ghost" size="sm" disabled={activePage===0} onClick={()=>setPage(activePage-1)}>Previous</Button><span>Page {activePage+1} of {Math.ceil(rows.length/25)}</span><Button variant="ghost" size="sm" disabled={(activePage+1)*25>=rows.length} onClick={()=>setPage(activePage+1)}>Next</Button></div>}
          </section>
          {analysis.duplicateIds.length>0 && <label className="flex items-start gap-2 rounded-lg border p-3 text-xs leading-relaxed"><input type="checkbox" className="mt-0.5 size-4" checked={duplicatesReviewed} disabled={busy||!editable} onChange={e=>setDuplicatesReviewed(e.target.checked)}/><span>I checked the possible duplicates against the statement. Repeated amounts can be genuine separate purchases; incorrect duplicates should be corrected in account activity.</span></label>}
          {editable && <div className="space-y-3"><p className="text-xs text-muted-foreground">Saving or completing this review does not post a transaction. Reload saved progress if another reviewer has made changes.</p><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={()=>void run(()=>save(false))}>Save progress</Button><Button disabled={busy||!analysis.canComplete} onClick={()=>void run(()=>save(true))}>{busy?"Saving…":"Complete review"}</Button></div></div>}
          {correctionsEnabled&&editable&&analysis.difference!=="0.00"&&<StatementCorrection key={review.id+":"+review.version} review={review} difference={analysis.difference}
            ready={choicesSaved&&analysis.unreviewed===0&&(!analysis.duplicateIds.length||duplicatesReviewed)} busy={busy} run={run}
            onRecorded={async updated=>{select(updated);setMessage("Correction recorded. Start a fresh review to check the updated ledger.");await refresh();}}/>}
        </>}
      </div>
      <aside className="dashboard-panel p-4"><div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">Saved reviews</h2><Button variant="ghost" size="sm" aria-label="Refresh saved reviews" disabled={busy} onClick={()=>void run(refresh)}><RefreshCw className="size-3.5"/></Button></div><p className="mb-3 text-xs text-muted-foreground">20 most recent · checked against the current ledger on load</p>
        {reviews.length===0 ? <p className="text-sm text-muted-foreground">Your first saved statement review will appear here.</p> : <ul className="divide-y">{reviews.map(item=><li key={item.id}><button disabled={busy} onClick={()=>void run(()=>open(item.id))} className="w-full rounded-lg px-2 py-3 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"><span className="block text-xs font-medium">{item.start} — {item.end}</span><span className="mt-1 block text-xs text-muted-foreground">{statusLabel[item.effectiveStatus]} · {item.actorName}</span></button></li>)}</ul>}
      </aside>
    </div>
  </div>;
}
