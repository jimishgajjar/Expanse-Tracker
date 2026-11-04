"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { ConfirmDialog } from "./confirm-dialog";
import { useFormat } from "./settings-provider";
import { confirmSettlement, loadSettlement, reopenSettlement } from "@/lib/reimbursement-actions";
import type { reviewReimbursement, SettlementPayment, SettlementRow } from "@/lib/reimbursements";

type Review = Awaited<ReturnType<typeof reviewReimbursement>>;
const control = "min-h-10 w-full min-w-0 rounded-lg border bg-background px-2 text-sm";
function candidateLabel(c:Review["candidates"][number]) {
  return [c.date, c.destination ? c.account+" → "+c.destination : c.account, c.note || c.kind].join(" · ");
}
function useRefreshLedger() {
  const router = useRouter();
  return () => { window.dispatchEvent(new Event("ledger-changed")); router.refresh(); };
}

export function ReimbursementDialog({workspace,peer,name}:{workspace:string;peer:string;name:string}) {
  const [open,setOpen] = useState(false);
  const [review,setReview] = useState<Review>();
  const [error,setError] = useState("");
  const [pending,start] = useTransition();
  const refresh = useRefreshLedger();
  function load() {
    setError(""); setReview(undefined);
    start(async () => {
      try {
        const answer = await loadSettlement(workspace,peer);
        if (answer.ok) setReview(answer.value); else setError(answer.error);
      } catch { setError("Couldn’t load the current balance. Try again."); }
    });
  }
  return <Dialog open={open} onOpenChange={next => {setOpen(next); if(next) load();}}>
    <DialogTrigger render={<Button size="sm" variant="outline"/>}>Settle up</DialogTrigger>
    <DialogContent>
      <DialogHeader><DialogTitle>Settle up with {name}</DialogTitle>
        <DialogDescription>Review the open IOUs and choose how to account for the payment.</DialogDescription></DialogHeader>
      {pending && <p role="status">Checking the balance…</p>}
      {error && <p role="alert">{error} <Button size="sm" variant="outline" onClick={load}>Try again</Button></p>}
      {review && <SettlementForm key={review.version} {...{workspace,peer,review,name}} onReload={load}
        onDone={() => {setOpen(false);refresh();toast.success("Reimbursement settled");}}/>}
    </DialogContent>
  </Dialog>;
}

function SettlementForm({workspace,peer,name,review,onDone,onReload}:{workspace:string;peer:string;name:string;review:Review;onDone:()=>void;onReload:()=>void}) {
  const {money} = useFormat();
  const [mode,setMode] = useState<SettlementPayment["mode"]>("link");
  const [key,setKey] = useState("");
  const [accounts,setAccounts] = useState<"one"|"two">("one");
  const [account,setAccount] = useState("");
  const [destination,setDestination] = useState("");
  const [date,setDate] = useState(review.day);
  const [checked,setChecked] = useState(false);
  const [requestId] = useState(() => crypto.randomUUID());
  const [error,setError] = useState("");
  const [pending,start] = useTransition();
  const received = review.kind === "income";
  const both = accounts === "two";
  const label = mode === "link" ? "Link payment and settle" : mode === "outside" ? "Mark settled outside tracker" : both ? "Record transfer and settle" : "Record payment and settle";
  const choices = [["link","Link existing payment"],["record","Record new payment"],["outside","Paid outside tracker"]] as const;
  const opts = review.accounts.map(a => <option value={a.id} key={a.id}>{a.name}</option>);
  return <form className="space-y-3" onSubmit={e => {
    e.preventDefault();
    const payment:SettlementPayment = mode === "link" ? {mode,key} : mode === "outside" ? {mode} :
      {mode,account,toAccount:both ? destination : null,date,checkedMatches:checked};
    start(async () => {
      try {
        const answer = await confirmSettlement(workspace,{id:requestId,peer,version:review.version,payment});
        if (answer.ok) onDone(); else setError(answer.error);
      } catch {setError("Couldn’t confirm. Review the current balance before trying again.");}
    });
  }}>
    <fieldset disabled={pending} className="min-w-0 space-y-3">
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{received ? name+" owes you" : "You owe "+name}</p>
      <strong className="amount text-xl">{money(Number(review.amount))}</strong>
      <details className="mt-1 text-xs"><summary className="cursor-pointer">Review {review.items.length} open {review.items.length===1?"item":"items"}</summary>
        <ul className="mt-2 space-y-1">{review.items.map(i => <li className="flex justify-between gap-2" key={i.id}><span>{i.note || "Shared expense"}</span>
          <span className="amount">{i.creditor===peer?"−":"+"}{money(Number(i.amount))}</span></li>)}</ul></details>
    </div>
    <label className="block space-y-1">Settlement method<select disabled={pending} className={control} value={mode}
      onChange={e => setMode(e.target.value as SettlementPayment["mode"])}>{choices.map(([v,n]) => <option key={v} value={v}>{n}</option>)}</select></label>
    {mode === "link" && (review.candidates.length ? <label className="block space-y-1">Matching posted payment
      <select required value={key} className={control} onChange={e => setKey(e.target.value)}><option value="">Choose a payment</option>
        {review.candidates.map(c => <option key={c.key} value={c.key}>{candidateLabel(c)}</option>)}</select>
      <span className="text-xs text-muted-foreground">Linking keeps the existing ledger amount.</span></label> :
      <p className="text-sm text-muted-foreground">No posted payment matches this amount and direction.</p>)}
    {mode === "record" && <>
      <label className="block space-y-1">Where did the money move?<select className={control} value={accounts}
        onChange={e => {setAccounts(e.target.value as "one"|"two");setAccount("");setDestination("");}}>
        <option value="one">{received?"Into":"Out of"} one tracked account</option><option value="two">Between two tracked accounts</option>
      </select></label>
      <div className="grid gap-2 sm:grid-cols-2">
        <label>{both?(received?name+" paid from":"You paid from"):received?"Receiving account":"Paying account"}<select className={control} required value={account}
          onChange={e => {setAccount(e.target.value);if(destination===e.target.value)setDestination("");}}><option value="">Choose account</option>{opts}</select></label>
        {both && <label>{received?"You received in":name+" received in"}<select required className={control} value={destination} onChange={e => setDestination(e.target.value)}>
          <option value="">Choose account</option>{review.accounts.filter(a=>a.id!==account).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
        <label>Payment date<input required type="date" className={control} max={review.day} value={date} onChange={e=>setDate(e.target.value)}/></label>
      </div>
      <p className="text-xs text-muted-foreground">{both?"A transfer moves the balance between accounts and keeps household income and spending totals the same.":
        "This adds one "+review.kind+" entry to the selected account."}</p>
      {review.candidates.length>0 && <div className="rounded-lg border p-3 text-xs">
        <details><summary className="cursor-pointer">Review {review.candidates.length} possible {review.candidates.length===1?"match":"matches"}</summary>
          <ul className="mt-2 space-y-1">{review.candidates.map(c => <li key={c.key}>{candidateLabel(c)}</li>)}</ul></details>
        <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={checked} required onChange={e=>setChecked(e.target.checked)}/>This is a separate payment.</label></div>}
    </>}
    {mode === "outside" && <p className="text-sm text-muted-foreground">This closes the reviewed IOUs. Account balances stay the same.</p>}
    </fieldset>
    {error && <div role="alert">{error} <Button type="button" variant="outline" size="sm" onClick={onReload}>Review again</Button></div>}
    <DialogFooter><Button type="submit" disabled={pending || !!error || (mode==="link" && !key) || (mode==="record" && !review.accounts.length)}>
      {pending?"Settling…":label}</Button></DialogFooter>
  </form>;
}

export function SettlementHistory({workspace,rows,canEdit}:{workspace:string;rows:SettlementRow[];canEdit:boolean}) {
  const {money} = useFormat();
  const refresh = useRefreshLedger();
  if (!rows.length) return null;
  return <div className="space-y-2"><h3 className="text-xs font-semibold text-muted-foreground">Settled reimbursements</h3>
    {rows.map(r => <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl border p-3 text-sm">
      <div className="min-w-0 flex-1"><p className="font-medium">{r.name} · {money(Number(r.amount))}</p>
        <p className="text-xs text-muted-foreground">{r.date} · {r.method==="link"?"Linked payment":r.method==="record"?"Recorded payment":"Paid outside tracker"}
          {r.paymentLabel && " · "+r.paymentLabel}</p></div>
      {canEdit && <ConfirmDialog trigger={<Button size="sm" variant="outline">Reopen</Button>} title="Reopen the settled IOUs?"
        description={r.count+" open "+(r.count===1?"item will":"items will")+" return. Any payment stays in Activity."} confirmLabel="Reopen IOUs"
        onConfirm={async()=>{const res=await reopenSettlement(workspace,r.id);if(res.ok){refresh();toast.success("IOUs reopened");}else toast.error(res.error);}}/>}
    </div>)}</div>;
}
