"use client";

import {useState} from "react";
import type {Command} from "@/app/bank-inbox/actions";
import type {InboxView} from "@/lib/plaid-sandbox/inbox";
import type {ReviewOptions, Candidate, Decision} from "@/lib/plaid-sandbox/reviews";
import {Button} from "./ui/button";

type Row = NonNullable<InboxView>["records"][number];
type Props = {
  row:Row; connection:string; options:ReviewOptions; busy:boolean;
  preview:(cmd:Extract<Command,{op:"preview"}>)=>Promise<{amount:string;candidates:Candidate[]}>;
  save:(cmd:Extract<Command,{op:"decide"}>)=>Promise<void>;
  close:()=>void;
};
const field="mt-1 block w-full rounded-md border bg-background px-2 py-1.5 text-sm";

export function BankEntryReview({row,connection,options,busy,preview,save,close}:Props) {
  const [account,setAccount]=useState(""),[category,setCategory]=useState(""),[settled,setSettled]=useState("");
  const [result,setResult]=useState<{amount:string;candidates:Candidate[]}|null>(null);
  const [target,setTarget]=useState(""),[ack,setAck]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState("");
  const source={id:connection,record:row.id,version:row.version};
  const booking={account,currency:options.currency,settled};
  const fx=row.currency!==options.currency;
  const disabled=busy||loading;
  const kind=row.amount<0?"income":"expense";
  function reset(){setResult(null);setAck(false);setTarget("");setError("");}
  async function check(){
    setLoading(true);setError("");
    try{setResult(await preview({op:"preview",...source,...booking}));}
    catch(e){setError(e instanceof Error?e.message:"Could not preview this entry.");}
    finally{setLoading(false);}
  }
  function decide(decision:Decision){return save({op:"decide",...source,decision});}
  return <div className="mt-2 space-y-3 rounded-lg border bg-muted/30 p-3">
    <div className="flex items-center justify-between"><strong>Review bank entry</strong><Button size="sm" variant="ghost" disabled={disabled} onClick={close}>Close</Button></div>
    {row.currency&&row.amount!==0&&<>
      <div className="grid gap-2 sm:grid-cols-2">
        <label>Tracker account<select className={field} disabled={disabled} value={account} onChange={e=>{reset();setAccount(e.target.value);}}>
          <option value="">Choose an account</option>{options.accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        <label>Category for import<select className={field} disabled={disabled} value={category} onChange={e=>{reset();setCategory(e.target.value);}}>
          <option value="">Uncategorized</option>{options.categories.filter(c=>c.kind===kind).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        {fx&&<label>Settled amount in {options.currency}<input className={field} disabled={disabled} inputMode="decimal" value={settled} onChange={e=>{reset();setSettled(e.target.value);}} placeholder="Amount shown on your statement"/></label>}
      </div>
      {!result?<Button size="sm" disabled={disabled||!account||(fx&&!settled.trim())} onClick={()=>void check()}>Preview entry</Button>:<>
        <p className="text-sm"><strong>{kind==="income"?"Add":"Deduct"} {options.currency} {result.amount}</strong> {kind==="income"?"to":"from"} {options.accounts.find(a=>a.id===account)?.name} on {row.date} · {options.categories.find(c=>c.id===category)?.name??"Uncategorized"}</p>
        {result.candidates.length>0?<div className="space-y-2">
          <label>Possible existing payments<select className={field} disabled={disabled} value={target} onChange={e=>setTarget(e.target.value)}>
            <option value="">Choose a payment to match</option>{result.candidates.map(c=><option key={c.id} value={c.id}>{c.date} · {c.label}</option>)}</select></label>
          <Button size="sm" variant="outline" disabled={disabled||!target} onClick={()=>void decide({kind:"match",...booking,target})}>Match existing</Button>
          <label className="flex items-center gap-2"><input type="checkbox" disabled={disabled} checked={ack} onChange={e=>setAck(e.target.checked)}/>This is a separate payment from the suggested matches.</label>
        </div>:<p className="text-xs text-muted-foreground">No available match with this amount and direction within seven days.</p>}
        <Button size="sm" disabled={disabled||(result.candidates.length>0&&!ack)} onClick={()=>void decide({kind:"import",...booking,category:category||null,acknowledgeMatches:ack})}>Confirm import</Button>
      </>}
    </>}
    {error&&<p role="alert">{error}</p>}
    <div className="border-t pt-2"><Button size="sm" variant="ghost" disabled={disabled} onClick={()=>void decide({kind:"ignore"})}>Ignore entry</Button><span className="text-xs text-muted-foreground">Keeps this payment out of the tracker.</span></div>
  </div>;
}
