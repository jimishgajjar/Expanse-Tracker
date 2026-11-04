"use client";

import { useRef,useState } from "react";
import { Button } from "./ui/button";
import { inspectImport,previewImport,reopenImport,commitImport } from "@/lib/file-import-actions";
import { fields,type Mapping,type Batch } from "@/lib/file-import-model";

type Inspection=Extract<Awaited<ReturnType<typeof inspectImport>>,{ok:true}>["data"];
type Recent={id:string;filename:string;approved:boolean};
const control="block w-full min-w-0 rounded-lg border bg-background px-2 py-2 text-sm";
const panel="dashboard-panel space-y-4 p-4";
export function FileImportReview({recent}:{recent:Recent[]}){
  const [file,setFile]=useState<File|null>(null),[info,setInfo]=useState<Inspection|null>(null);
  const [mapping,setMapping]=useState<Mapping|null>(null),[confirmed,setConfirmed]=useState(false);
  const [batch,setBatch]=useState<Batch|null>(null),[choices,setChoices]=useState<Record<string,string>>({});
  const [history,setHistory]=useState(recent),[page,setPage]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const working=useRef(false);
  async function run(fn:()=>Promise<void>){if(working.current)return;working.current=true;setBusy(true);setError("");
    try{await fn();}catch(e){setError(e instanceof Error?e.message:"Request interrupted. Reopen the saved batch to check its status.");}
    finally{working.current=false;setBusy(false);}}
  function data(){const f=new FormData();if(file)f.set("file",file);return f;}
  function show(b:Batch){setBatch(b);setPage(0);setChoices({});setHistory(old=>[{id:b.id,filename:b.filename,approved:!!b.receipt},...old.filter(x=>x.id!==b.id)].slice(0,20));}
  function reset(){setBatch(null);setInfo(null);setFile(null);setMapping(null);setConfirmed(false);setError("");}
  const totals=Object.values(choices).reduce((a,v)=>{if(v==="ignore")a.ignored++;else if(v.startsWith("match:"))a.matched++;else if(v)a.added++;return a;},{added:0,matched:0,ignored:0});
  return <div className="space-y-4">
    <p className="max-w-2xl text-sm text-muted-foreground">Preview a bank file, compare it with Activity, then approve the entries you want to add. Matching an entry leaves it unchanged.</p>
    {error&&<p role="alert" className="rounded-lg border border-negative p-3 text-sm">{error}</p>}
    {!batch&&<section className={panel}>
      <h2 className="font-semibold">1 · Choose a file</h2>
      <label className="block text-sm">CSV or Excel workbook<input type="file" accept=".csv,.xlsx" className={control} disabled={busy} onChange={e=>{setFile(e.target.files?.[0]??null);setInfo(null);setMapping(null);setConfirmed(false);setError("");}}/></label>
      <p className="text-xs text-muted-foreground">Up to 300 transactions and 512 KB. For a multi-sheet workbook, the Transactions sheet is used. Tags, transfers and other sheets are not imported.</p>
      <Button variant="outline" disabled={!file||busy} onClick={()=>void run(async()=>{const r=await inspectImport(data());if(!r.ok)throw Error(r.error);setInfo(r.data);setMapping(r.data.mapping);setConfirmed(false);})}>Read columns</Button>
    </section>}
    {!batch&&info&&mapping&&<section className={panel}>
      <h2 className="font-semibold">2 · Map {info.count} rows</h2><p className="text-sm">{info.reused?"Reused the last mapping for these headers. Check it before continuing.":"Choose the source column for each field. Sample values are shown beside column names."}</p>
      <div className="grid gap-3 sm:grid-cols-2">{fields.map(key=><label key={key} className="text-xs font-medium capitalize">{key}{["date","amount"].includes(key)?" (required)":""}
        <select className={control} value={mapping[key]} disabled={busy} onChange={e=>setMapping({...mapping,[key]:Number(e.target.value)})}><option value={-1}>No column</option>{info.headers.map((h,i)=><option value={i} key={i}>{h} · {info.sample[i]||"Blank"}</option>)}</select></label>)}
        <label className="text-xs font-medium">Date format<select className={control} disabled={busy} value={mapping.dateOrder} onChange={e=>setMapping({...mapping,dateOrder:e.target.value as Mapping["dateOrder"]})}><option value="ISO">Year-month-day</option><option value="DMY">Day/month/year</option><option value="MDY">Month/day/year</option></select></label>
        <label className="text-xs font-medium">Account for rows without one<select className={control} disabled={busy} value={mapping.fallback} onChange={e=>setMapping({...mapping,fallback:e.target.value})}><option value="">Require an account in the file</option>{info.accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
      </div>
      {mapping.type<0&&<p className="text-sm">Without a Type column, negative amounts are expenses and positive amounts are income.</p>}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/>My amounts are in {info.currency}. No currency conversion is applied.</label>
      <Button disabled={busy||!confirmed||mapping.date<0||mapping.amount<0} onClick={()=>void run(async()=>{const r=await previewImport(data(),mapping,info.hash,info.currency);if(!r.ok)throw Error(r.error);show(r.data);})}>Preview rows</Button>
    </section>}
    {batch&&<section className={panel}>
      <div className="flex flex-wrap justify-between gap-2"><div><h2 className="font-semibold">{batch.receipt?"Import receipt":"3 · Review each row"}</h2><p className="text-xs text-muted-foreground">{batch.filename} · {batch.rows.length} rows · {batch.currency}</p></div><Button variant="outline" disabled={busy} onClick={reset}>Choose another file</Button></div>
      {batch.receipt?<p role="status" className="text-sm">Approved: {batch.receipt.filter(r=>r.action==="import").length} added, {batch.receipt.filter(r=>r.action==="match").length} matched, {batch.receipt.filter(r=>r.action==="ignore").length} ignored. Reopening this file does not post it again.</p>:<p className="text-sm">Nothing has been posted. Choose an outcome for every row. To correct a mapping or refresh matches, preview the file again.</p>}
      <ol className="divide-y">{batch.rows.slice(page*25,page*25+25).map(r=>{
        const duplicate=r.repeated||r.candidates.length>0,done=batch.receipt?.find(o=>o.line===r.line);
        return <li key={r.line} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,17rem)]">
          <div className="min-w-0"><p className="break-words text-sm font-medium">Row {r.line} · {r.note||r.type||"Unnamed entry"}</p><p className="text-xs">{r.date} · {r.type} · {batch.currency} {r.amount} · {r.account||"No account"}{r.category?" · "+r.category:""}</p>
          {r.cutoff && <p className="text-xs">Covered by the opening statement through {r.cutoff}. Match an existing entry or ignore this row.</p>}{r.errors.map(e=><p key={e} className="text-xs text-negative">{e}</p>)}{duplicate&&<p className="text-xs text-muted-foreground">{r.repeated?"Same date and amount appears in this file. ":""}{r.candidates.length>0?r.candidates.length+" possible ledger matches.":""}</p>}</div>
          {done?<span className="text-sm">{({import:"Added",match:"Matched existing",ignore:"Ignored"})[done.action]}</span>:<select aria-label={"Decision for row "+r.line} className={control} disabled={busy} value={choices[r.line]??""} onChange={e=>setChoices({...choices,[r.line]:e.target.value})}>
            <option value="">Choose an outcome</option><option value="ignore">Ignore this row</option>{!r.errors.length&&<>{!r.cutoff && <option value={duplicate?"separate":"import"}>{duplicate?"Add as a separate transaction":"Add transaction"}</option>}{r.candidates.map(c=><option key={c.id} value={"match:"+c.id}>Match: {c.note||"Untitled"} · {c.id.slice(-8)}</option>)}</>}</select>}
        </li>;})}</ol>
      {batch.rows.length>25&&<div className="flex items-center gap-3"><Button variant="ghost" disabled={page===0} onClick={()=>setPage(page-1)}>Previous</Button><span>Page {page+1} / {Math.ceil(batch.rows.length/25)}</span><Button variant="ghost" disabled={(page+1)*25>=batch.rows.length} onClick={()=>setPage(page+1)}>Next</Button></div>}
      {!batch.receipt&&<div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3"><span className="text-sm">{totals.added} to add · {totals.matched} to match · {totals.ignored} to ignore</span><Button disabled={busy||totals.added+totals.matched+totals.ignored!==batch.rows.length} onClick={()=>void run(async()=>{const r=await commitImport(batch.id,batch.version,choices);if(!r.ok)throw Error(r.error);show(r.data);})}>Approve batch</Button></div>}
    </section>}
    {busy&&<p role="status" className="text-sm">Working…</p>}
    {history.length>0&&<section className={panel}><h2 className="font-semibold">Recent batches</h2><ul className="divide-y">{history.map(h=><li key={h.id}><button className="flex w-full justify-between gap-2 py-2 text-left text-sm" disabled={busy} onClick={()=>void run(async()=>{const r=await reopenImport(h.id);if(!r.ok)throw Error(r.error);show(r.data);})}>{h.filename}<span>{h.approved?"Receipt":"Awaiting review"}</span></button></li>)}</ul></section>}
  </div>;
}
