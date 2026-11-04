"use client";
import {useEffect,useState} from "react";
import {Button} from "./ui/button";
import {useFormat} from "./settings-provider";
import {applySelection,getBulkTools,previewSelection,undoSelection} from "@/lib/bulk-edit-actions";
import type {BulkOperation,bulkTools,previewBulk,undoBulk} from "@/lib/bulk-edits";
import type {CategoryDTO,TransactionDTO} from "@/lib/queries";

type Tools=Awaited<ReturnType<typeof bulkTools>>;
type Preview=Awaited<ReturnType<typeof previewBulk>>;
const selectStyle="mt-1 block w-full rounded-lg border bg-background p-2 text-sm";
export default function BulkActivity({workspace,rows,categories}:{workspace:string;rows:TransactionDTO[];categories:CategoryDTO[]}){
  const {money}=useFormat();
  const [tools,setTools]=useState<Tools|null>(null);
  const [ids,setIds]=useState<string[]>([]),[kind,setKind]=useState<BulkOperation["kind"]>("category"),[target,setTarget]=useState("");
  const [preview,setPreview]=useState<(Preview&{batch:string})|null>(null);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
  const [outcomes,setOutcomes]=useState<Awaited<ReturnType<typeof undoBulk>>>([]);
  useEffect(()=>{
    let active=true;
    getBulkTools(workspace).then(result=>{
      if(active){if(result.ok)setTools(result.value);else setError(result.error);}
    }).catch(()=>{if(active)setError("Couldn’t load bulk editing tools. Close and reopen the panel.");});
    return ()=>{active=false;};
  },[workspace]);
  function invalidate(){setPreview(null);setMessage("");setError("");setOutcomes([]);}
  function toggle(id:string){
    invalidate();setIds(previous=>previous.includes(id)?previous.filter(i=>i!==id):[...previous,id]);
  }
  const operation:BulkOperation=kind==="category"?{kind,id:target==="__none__"?null:target}:{kind,id:target};
  const changeCount=preview?.rows.filter(row=>!row.skip).length??0;
  async function perform(task:()=>Promise<void>){
    if(busy)return;setBusy(true);setError("");setMessage("");setOutcomes([]);
    try{await task();}catch(e){setError(e instanceof Error?e.message:"Request failed. Check recent batches.");}
    finally{setBusy(false);}
  }
  async function refresh(){
    window.dispatchEvent(new Event("ledger-changed"));
    const result=await getBulkTools(workspace);
    if(result.ok)setTools(result.value);else setError(result.error);
  }
  async function showPreview(){
    const batch=crypto.randomUUID();
    const result=await previewSelection(workspace,{ids,operation,batch});
    if(!result.ok)throw Error(result.error);
    setPreview({...result.value,batch});
  }
  async function apply(){
    if(!preview)return;
    const result=await applySelection(workspace,{ids,operation,batch:preview.batch,key:preview.key});
    if(!result.ok){setPreview(null);throw Error(result.error);}
    const skipped=preview.rows.length-result.value.changed;
    setMessage(`Updated ${result.value.changed} · Skipped ${skipped}`);setPreview(null);setIds([]);
    await refresh();
  }
  async function undo(batch:string){
    const result=await undoSelection(workspace,batch);
    if(!result.ok)throw Error(result.error);
    setOutcomes(result.value);setPreview(null);await refresh();
  }
  return <fieldset disabled={busy} className="dashboard-panel space-y-3 p-4">
    <legend className="sr-only">Bulk category and tag edits</legend>
    <div><h3 className="text-sm font-semibold">Bulk edit</h3><p className="text-xs text-muted-foreground">Select up to 25 income or expense entries on this page.</p></div>
    <div className="flex items-center justify-between border-b pb-2 text-xs"><span>{ids.length} selected</span>
      <button type="button" className="text-brand" onClick={()=>{invalidate();setIds(ids.length?[]:rows.slice(0,25).map(t=>t.id));}}>
        {ids.length?"Clear selection":`Select ${Math.min(25,rows.length)} on this page`}</button></div>
    <div className="max-h-64 divide-y overflow-y-auto">
      {rows.map(t=><label key={t.id} className="flex min-h-10 items-center gap-2 text-sm">
        <input type="checkbox" checked={ids.includes(t.id)} disabled={!ids.includes(t.id)&&ids.length>=25} onChange={()=>toggle(t.id)}/>
        <span className="min-w-0 flex-1"><span className="block truncate">{t.note||t.category?.name||"Transaction"}</span>
          <small className="text-muted-foreground">{t.date} · {t.account?.name??"No account"}</small></span>
        <span className="tabular-nums">{money(t.receiptAmount??t.amount)}</span>
      </label>)}
      {!rows.length&&<p className="text-xs">No income or expense entries on this page.</p>}
    </div>
    <div className="grid gap-2 sm:grid-cols-2"><label className="text-xs">Change<select className={selectStyle} value={kind}
      onChange={e=>{invalidate();setKind(e.target.value as BulkOperation["kind"]);setTarget("");}}>
      <option value="category">Set category</option><option value="addTag">Add tag</option><option value="removeTag">Remove tag</option>
    </select></label>
    <label className="text-xs">{kind==="category"?"Category":"Tag"}<select className={selectStyle} value={target}
      onChange={e=>{invalidate();setTarget(e.target.value);}}>
      <option value="">{kind==="category"?"Choose a category":"Choose a tag"}</option>
      {kind==="category"&&<option value="__none__">Uncategorized</option>}
      {kind==="category"?categories.map(c=><option value={c.id} key={c.id}>{c.name} ({c.kind})</option>):tools?.tags.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}
    </select></label></div>
    {preview?<div className="space-y-2 rounded-lg border p-3"><h4 className="text-sm font-semibold">Review changes</h4>
      <ul className="space-y-2 text-xs">{preview.rows.map(r=><li key={r.id}><strong>{r.label}</strong> · {r.date} · {money(Number(r.amount))}
        <span className="block text-muted-foreground">{r.skip?`Skip: ${r.skip}`:`${r.before} → ${r.after}`}</span></li>)}</ul>
      <Button type="button" size="sm" disabled={!changeCount} onClick={()=>void perform(apply)}>Apply to {changeCount} {changeCount===1?"entry":"entries"}</Button>
    </div>:<Button type="button" size="sm" disabled={!tools||!ids.length||!target} onClick={()=>void perform(showPreview)}>Preview changes</Button>}
    <p role="status" className="text-xs">{busy?"Working…":message}</p>
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
    {!!tools?.batches.length&&<div className="space-y-2 border-t pt-3"><h4 className="text-xs font-semibold">Your recent batches</h4>
      <p className="text-xs text-muted-foreground">Undo skips entries edited since the batch.</p>
      {tools.batches.map(b=><div key={b.id} className="flex items-center justify-between gap-2 text-xs">
        <span>{b.date.slice(0,19)} · {b.count} {b.count===1?"entry":"entries"}</span>
        <Button type="button" size="sm" variant="outline" disabled={b.restored===b.count} onClick={()=>void perform(()=>undo(b.id))}>{b.restored===b.count?"Restored":"Undo batch"}</Button>
      </div>)}</div>}
    {outcomes.length>0&&<ul aria-label="Undo results" className="text-xs">{outcomes.map(r=><li key={r.id}>{r.label} · {r.status}</li>)}</ul>}
  </fieldset>;
}
