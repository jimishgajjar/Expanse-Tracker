"use client";

import { useRef, useState } from "react";
import { correctStatement } from "@/lib/statement-review-actions";
import { moneyCents, type StatementReview } from "@/lib/statement-review";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type Props = {
  review: StatementReview; difference:string; ready:boolean; busy:boolean;
  run:(action:()=>Promise<void>)=>Promise<void>;
  onRecorded:(updated:StatementReview)=>Promise<void>;
};
export function StatementCorrection({review,difference,ready,busy,run,onRecorded}:Props){
  const [type,setType]=useState(""),[amount,setAmount]=useState(""),[date,setDate]=useState("");
  const [verified,setVerified]=useState(false),[separate,setSeparate]=useState(false);
  const request=useRef<string|null>(null);
  const duplicate=/^\d{1,12}(\.\d{1,2})?$/.test(amount)&&review.snapshot.entries.some(entry=>
    entry.kind===type&&entry.date===date&&moneyCents(entry.amount)===moneyCents(amount));
  function changed(){setVerified(false);setSeparate(false);}
  return <section className="dashboard-panel space-y-3 p-4">
    <h3 className="text-sm font-semibold">Investigate the difference</h3>
    <p className="text-sm">The statement closes {review.snapshot.currency} {difference.replace(/^-/,"")} {difference.startsWith("-")?"below":"above"} the starting balance plus cleared entries.</p>
    <p className="text-xs text-muted-foreground">Compare the opening balance, outstanding payments and transfers first. A difference alone does not identify a missing transaction.</p>
    {!ready?<p className="text-xs font-medium">Review every entry, check possible duplicates, and save your progress before recording a correction.</p>:
      <details><summary className="cursor-pointer text-sm font-medium text-brand">Record a verified missing entry</summary>
        <form className="mt-3 space-y-3" onSubmit={e=>{
          e.preventDefault();const form=new FormData(e.currentTarget);
          void run(async()=>{
            request.current??=crypto.randomUUID();
            const result=await correctStatement({id:review.id,version:review.version,requestId:request.current,
              date,type,amount,description:form.get("description"),reason:form.get("reason"),verified,separatePurchase:duplicate&&separate});
            if(!result.ok)throw new Error(result.error);
            await onRecorded(result.review);
          });
        }}>
          <fieldset disabled={busy} className="grid gap-3 text-xs sm:grid-cols-2">
            <label>Entry type<select className="mt-1 block h-9 w-full rounded-lg border bg-background px-2" required value={type} onChange={e=>{changed();setType(e.target.value);}}>
              <option value="">Choose type</option><option value="expense">Expense</option><option value="income">Income / refund</option>
            </select></label>
            <label>Amount on statement ({review.snapshot.currency})<Input required inputMode="decimal" value={amount} onChange={e=>{changed();setAmount(e.target.value);}}/></label>
            <label>Posting date<Input required type="date" min={review.start} max={review.end} value={date} onChange={e=>{changed();setDate(e.target.value);}}/></label>
            <label>Description<Input required maxLength={160} name="description" onChange={changed}/></label>
            <label className="sm:col-span-2">Why is this correction needed?<Input required name="reason" maxLength={300} onChange={changed}/></label>
          </fieldset>
          {duplicate&&<label className="flex gap-2 text-xs"><input type="checkbox" disabled={busy} checked={separate} onChange={e=>setSeparate(e.target.checked)}/>I checked the existing entry with this date and amount. This is a separate transaction.</label>}
          <label className="flex gap-2 text-xs"><input type="checkbox" disabled={busy} checked={verified} onChange={e=>setVerified(e.target.checked)}/>I verified this entry on the statement and want to add it to this account.</label>
          <p className="text-xs text-muted-foreground">This changes the account balance. The entry will be labelled “Statement correction” and its reason will be saved in history. You will need a fresh review.</p>
          <Button type="submit" disabled={busy||!verified||!date||!type||!amount||(duplicate&&!separate)}>Record missing entry</Button>
        </form>
      </details>}
  </section>;
}
