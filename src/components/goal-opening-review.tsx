"use client";
import {useRef,useState} from "react";
import type {GoalProgress} from "@/lib/goal-progress";
import {saveGoalOpeningReview} from "@/lib/monthly-planning-actions";
import {Button} from "./ui/button";
import {useFormat} from "./settings-provider";

export function GoalOpeningReview({workspace,progress,canEdit,refresh}:{
  workspace:string;progress:GoalProgress[];canEdit:boolean;refresh:()=>void;
}){
  const {money}=useFormat();
  const [editing,setEditing]=useState<GoalProgress|null>(null);
  const [amount,setAmount]=useState(""),[busy,setBusy]=useState(false);
  const [error,setError]=useState(""),[status,setStatus]=useState("");
  const request=useRef<{key:string;id:string}|null>(null);
  const openings=progress.filter(g=>Number(g.opening)>0);
  if(!openings.length)return progress.length?<p className="text-xs text-muted-foreground">These goals have no manual opening savings to review.</p>:null;

  function edit(g:GoalProgress){
    setEditing(g);setAmount(g.reviewed?g.outside:"");setStatus("");setError("");request.current=null;
  }
  async function save(e:React.FormEvent){
    e.preventDefault();
    if(!editing||busy)return;
    setBusy(true);setError("");
    const payload={goal:editing.id,opening:editing.opening,reserved:editing.reserved,version:editing.version,outside:amount};
    const key=JSON.stringify(payload);
    if(request.current?.key!==key)request.current={key,id:crypto.randomUUID()};
    try{
      const result=await saveGoalOpeningReview(workspace,{...payload,id:request.current.id});
      if(!result.ok){setError(result.error);return;}
      setEditing(null);setStatus("Opening progress reviewed.");
      window.dispatchEvent(new Event("ledger-changed"));
    }catch{setError("Couldn’t confirm the save. Retry or reload the plan.");}
    finally{setBusy(false);}
  }
  return <section id="goal-opening-review" className="space-y-3 border-t pt-3">
    <h3 className="font-semibold">Review opening savings</h3>
    <p className="text-xs text-muted-foreground">Your original entries are preserved. Goal progress includes reserved cash and any separate savings you confirm for that goal.</p>
    {openings.map(g=><div className="space-y-1 rounded-lg border p-3 text-xs" key={g.id}>
      <div className="flex flex-wrap items-center justify-between gap-2"><strong>{g.name}</strong>
        <span>{g.reviewed?"Reviewed":"Awaiting review"}</span></div>
      <p>Original entry {money(Number(g.opening))} · Reserved cash {money(Number(g.reserved))}</p>
      <p>Confirmed separate savings {money(Number(g.outside))} · Goal progress {money(Number(g.confirmed))}</p>
      {canEdit&&editing?.id!==g.id&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>edit(g)}>{g.reviewed?"Revise review":"Review amount"}</Button>}
      {canEdit&&editing?.id===g.id&&<form onSubmit={save} className="space-y-2 pt-2">
        <label className="block">Amount held outside tracked accounts
          <input className="mt-1 block min-h-9 w-full rounded-lg border bg-background px-2" type="number" min="0" max={editing.opening}
            step="0.01" required value={amount} disabled={busy} onChange={e=>setAmount(e.target.value)}/></label>
        <p>Enter 0 if the original savings are already in a tracked account. Include only money set aside for this goal. If you move it into a tracked account later, revise this amount.</p>
        {amount!==""&&Number(amount)>=0&&Number(amount)<=Number(editing.opening)&&<p>Goal progress after review: <strong>{money(Number(editing.reserved)+Number(amount))}</strong></p>}
        {error&&<p role="alert">{error} <button type="button" className="underline" onClick={()=>{setEditing(null);setError("");refresh();}}>Reload plan</button></p>}
        <div className="flex gap-2"><Button type="submit" size="sm" disabled={busy||amount===""}>Save review</Button>
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={()=>setEditing(null)}>Cancel</Button></div>
      </form>}
    </div>)}
    {status&&<p role="status" className="text-xs">{status}</p>}
  </section>;
}
