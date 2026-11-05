"use client";
import {useEffect,useRef,useState} from "react";
import {ArrowRight,Calculator,RefreshCw,X} from "lucide-react";
import {previewPurchase,keepForecastPlan,savedForecastPlans,reviewForecastPlan} from "@/lib/affordability-actions";
import type {checkAffordability,compareForecastBaseline,listForecastBaselines} from "@/lib/affordability-store";
import type {PlanOptions} from "@/lib/affordability-model";
import {useSettings} from "./settings-provider";
import {useTrackerReady} from "./tracker-boundary";
import {Button} from "./ui/button";

type Check=Awaited<ReturnType<typeof checkAffordability>>;
type Comparison=Awaited<ReturnType<typeof compareForecastBaseline>>;
type Saved=Awaited<ReturnType<typeof listForecastBaselines>>;
type Props={workspace:string;accounts:{id:string;name:string}[];horizon:PlanOptions["horizon"];scenario:PlanOptions["scenario"];includeExpectedPay:boolean;start:string;end:string;canEdit:boolean};
const control="mt-1 block min-h-11 w-full min-w-0 rounded-lg border bg-background px-3 text-sm";
const kinds={correction:"Ledger changed since saving",timing:"Different posting date",amount:"Different amount",unconfirmed:"No unique recorded match",recorded:"Additional recorded activity",allowance:"Everyday spending estimate",matched:"Matches recorded activity"};

export function PurchaseCheck(props:Props){
  const [open,setOpen]=useState(false);
  if(!props.accounts.length)return null;
  return <section className="rounded-xl border border-brand/20 bg-brand/5" aria-label="Purchase check">
    <header className="flex items-center justify-between gap-3 p-3">
      <div className="flex items-center gap-2"><Calculator className="size-4 text-brand" aria-hidden/><div>
        <h3 className="text-sm font-semibold">Can we afford this?</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Try a purchase or compare a saved plan.</p>
      </div></div>
      <Button size={open?"icon":"sm"} className="min-h-11" variant="outline" aria-label={open?"Close and discard purchase scenario":"Open purchase check"} aria-expanded={open} onClick={()=>setOpen(value=>!value)}>
        {open?<X className="size-4"/>:<><span>Try it</span><ArrowRight className="size-3.5" aria-hidden/></>}
      </Button>
    </header>
    {open&&<PurchaseForm {...props}/>}
  </section>;
}

function PurchaseForm({workspace,accounts,horizon,scenario,includeExpectedPay,start,end,canEdit}:Props){
  const ready=useTrackerReady(),{locale}=useSettings();
  const [account,setAccount]=useState(accounts[0].id),[amount,setAmount]=useState(""),[date,setDate]=useState(start);
  const [result,setResult]=useState<Check|null>(null),[comparison,setComparison]=useState<Comparison|null>(null),[plans,setPlans]=useState<Saved|null>(null);
  const [selected,setSelected]=useState(""),[revision,reload]=useState(0),[limit,setLimit]=useState(8);
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const generation=useRef(0),saving=useRef(false),request=useRef<{id:string;fingerprint:string}|null>(null);
  useEffect(()=>()=>{generation.current++;},[]);
  useEffect(()=>{
    function changed(){generation.current++;request.current=null;setResult(null);setComparison(null);setNotice("Your plan changed. Calculate again to use the latest entries.");reload(n=>n+1);}
    window.addEventListener("ledger-changed",changed);window.addEventListener("forecast-changed",changed);
    return ()=>{window.removeEventListener("ledger-changed",changed);window.removeEventListener("forecast-changed",changed);};
  },[]);
  useEffect(()=>{
    if(!ready)return;
    let active=true;
    savedForecastPlans(workspace,account).then(res=>{
      if(!active)return;
      if(res.ok)setPlans(res.value);else {setPlans(null);setError(res.error);}
    }).catch(()=>{if(active){setPlans(null);setError("Couldn't load saved plans. Try refreshing.");}});
    return ()=>{active=false;};
  },[workspace,account,ready,revision]);
  const money=(value:string,currency:string)=>new Intl.NumberFormat(locale,{style:"currency",currency,currencyDisplay:"code"}).format(Number(value));
  const options:PlanOptions={account,horizon,scenario,includeExpectedPay};
  function edit(){generation.current++;request.current=null;setResult(null);setComparison(null);setError("");setNotice("");}
  async function run(kind:"calculate"|"save"|"compare"){
    if(!ready||saving.current)return;
    saving.current=true;setBusy(true);setError("");setNotice("");
    const current=++generation.current;
    try {
      if(kind==="calculate"){
        setResult(null);request.current=null;
        const res=await previewPurchase(workspace,{options,amount,date});
        if(current!==generation.current)return;
        if(res.ok)setResult(res.value);else setError(res.error);
      }else if(kind==="save"&&result?.fingerprint){
        if(request.current?.fingerprint!==result.fingerprint)request.current={id:crypto.randomUUID(),fingerprint:result.fingerprint};
        const res=await keepForecastPlan(workspace,{...request.current,options});
        if(current!==generation.current)return;
        if(res.ok){setSelected(res.value.id);setNotice("Original plan saved for you. The proposed purchase is still only a scenario.");reload(n=>n+1);}
        else setError(res.error);
      }else if(kind==="compare"&&selected){
        setComparison(null);setLimit(8);
        const res=await reviewForecastPlan(workspace,account,selected);
        if(current!==generation.current)return;
        if(res.ok)setComparison(res.value);else setError(res.error);
      }
    }catch{if(current===generation.current)setError("Couldn't confirm the request. Refresh saved plans before retrying a save.");}
    finally{saving.current=false;setBusy(false);}
  }
  const calculation=result?.calculation;
  return <div className="space-y-4 border-t border-brand/15 bg-background p-3" aria-busy={busy}>
    <p className="text-xs text-muted-foreground">{scenario==="base"?"Base":"Conservative"} plan · {start} to {end}. Uses one cash account, its bills, savings reservations and buffer. Closing this panel discards the purchase scenario.</p>
    <form onSubmit={event=>{event.preventDefault();void run("calculate");}}>
      <fieldset disabled={busy||!ready} className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs">Paying account<select className={control} value={account} onChange={event=>{edit();setAccount(event.target.value);setPlans(null);setSelected("");}}>
          {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
        </select></label>
        <label className="text-xs">Purchase amount<input className={control} inputMode="decimal" type="number" min="0.01" step="0.01" required placeholder="300.00" value={amount} onChange={event=>{edit();setAmount(event.target.value);}}/></label>
        <label className="text-xs">Purchase date<input className={control} type="date" required min={start} max={end} value={date} onChange={event=>{edit();setDate(event.target.value);}}/></label>
        <Button type="submit" size="sm" className="min-h-11 sm:col-span-3 sm:justify-self-start">{busy?"Working…":"Check this purchase"}</Button>
      </fieldset>
    </form>
    {error&&<p role="alert" className="text-sm text-negative">{error}</p>}
    {notice&&<p role="status" className="text-xs text-brand">{notice}</p>}
    {result&&<section aria-label="Purchase result" className="space-y-3 border-t pt-3">
      <h4 className="text-sm font-semibold" role="status">{!calculation?"A reliable calculation is unavailable":calculation.status==="incomplete"?"Review the missing information first":calculation.status==="shortfall"?"This would use protected cash":"This fits the recorded plan"}</h4>
      {result.issues.length>0&&<ul className="list-disc space-y-1 pl-4 text-xs text-amber-800 dark:text-amber-300">{result.issues.map(issue=><li key={issue}>{issue}</li>)}</ul>}
      {calculation&&<>
        <dl className="grid gap-3 rounded-lg border p-3 sm:grid-cols-3">
          <div><dt className="text-xs text-muted-foreground">Lowest without purchase</dt><dd className="mt-1 text-sm font-semibold tabular-nums">{money(calculation.baseline.lowest,result.currency)}</dd><dd className="mt-1 text-xs">{calculation.baseline.date}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Lowest with purchase</dt><dd className="mt-1 text-sm font-semibold tabular-nums">{money(calculation.proposed.lowest,result.currency)}</dd><dd className="mt-1 text-xs">{calculation.proposed.date}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Change in the lowest balance</dt><dd className="mt-1 text-sm font-semibold tabular-nums">{money(calculation.difference,result.currency)}</dd><dd className="mt-1 text-xs">Across this whole period</dd></div>
        </dl>
        <p className="text-xs">{Number(calculation.proposed.available)<0?"Shortfall against protected cash":"Remaining above protected cash"} · <strong className="tabular-nums">{money(String(Math.abs(Number(calculation.proposed.available))),result.currency)}</strong>. Keeps {money(result.reserved!,result.currency)} reserved for goals and {money(result.buffer!,result.currency)} as a buffer.</p>
        <div className="rounded-lg bg-muted/50 p-3 text-xs">
          <h5 className="font-semibold">What could change this answer?</h5>
          {calculation.sensitivity?<p className="mt-1">If {calculation.sensitivity.label} ({money(calculation.sensitivity.amount,result.currency)}) arrives seven days later, on {calculation.sensitivity.delayedDate}, the lowest balance with this purchase becomes <strong>{money(calculation.sensitivity.result.lowest,result.currency)}</strong> on {calculation.sensitivity.result.date}. This is the largest incoming amount in the plan.</p>
            :<p className="mt-1">Everyday spending is set to {money(result.daily!,result.currency)} per day. An extra {money("1",result.currency)} per day would reduce the closing balance by {money(calculation.extraDailyCost,result.currency)}. Unrecorded bills may reduce it further.</p>}
        </div>
        <p className="text-xs text-muted-foreground">This is an end-of-day estimate from recorded information. Same-day payment order, new spending and account gaps can change the outcome. The purchase has not been added to your ledger.</p>
        {result.canSave?<div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <Button variant="outline" size="sm" className="min-h-11" disabled={busy||!ready||!canEdit} onClick={()=>void run("save")}>Save original plan for comparison</Button>
          <p className="text-xs text-muted-foreground">Explicitly saves the forecast without this purchase. Visible to you while you retain access to its sources.</p>
          {!canEdit&&<p className="text-xs">Viewing access allows calculations. Saving a plan requires editing access.</p>}
        </div>:<p className="text-xs text-muted-foreground">Saving comparisons is not yet available on this server.</p>}
      </>}
    </section>}
    <details className="border-t pt-3">
      <summary className="min-h-11 cursor-pointer text-sm font-medium">What actually changed?</summary>
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">Compare your saved original forecast with recorded activity through today or its end date, whichever comes first. A missing match is not proof that a bill was unpaid.</p>
        <Button size="sm" variant="ghost" className="min-h-11" disabled={busy||!ready} onClick={()=>{setError("");setComparison(null);reload(n=>n+1);}}><RefreshCw className="size-3.5" aria-hidden/>Refresh saved plans</Button>
        {!plans?<p role="status" className="text-xs">Loading saved plans…</p>:!plans.items.length?<p className="text-xs">{plans.available?"No saved plans for you on this account yet.":"Saved comparisons are not available on this server yet."}</p>:<>
          <label className="block text-xs">Saved forecast<select className={control} disabled={busy} value={selected} onChange={event=>{setSelected(event.target.value);setComparison(null);}}>
            <option value="">Choose one of your latest 10 plans</option>
            {plans.items.map(plan=><option key={plan.id} value={plan.id}>{new Date(plan.at).toLocaleString(locale)} · {plan.scenario} · through {plan.end}</option>)}
          </select></label>
          <Button size="sm" className="min-h-11" disabled={!selected||busy||!ready} onClick={()=>void run("compare")}>Compare with recorded activity</Button>
        </>}
        {comparison&&<section aria-label="Saved forecast comparison" className="space-y-3">
          <h4 className="text-sm font-semibold">{comparison.account} · {comparison.start} through {comparison.through}</h4>
          <dl className="grid gap-3 rounded-lg border p-3 sm:grid-cols-3">
            <div><dt>Saved projection</dt><dd className="mt-1 font-semibold tabular-nums">{money(comparison.expected,comparison.currency)}</dd></div>
            <div><dt>Recorded balance</dt><dd className="mt-1 font-semibold tabular-nums">{money(comparison.actual,comparison.currency)}</dd></div>
            <div><dt>Difference</dt><dd className="mt-1 font-semibold tabular-nums">{money(comparison.difference,comparison.currency)}</dd></div>
          </dl>
          {comparison.issues.length>0&&<p className="text-xs text-muted-foreground">Saved plan limitations · {comparison.issues.join(" ")}</p>}
          <ul className="divide-y">{comparison.lines.slice(0,limit).map(line=><li key={line.key} className="space-y-1 py-2 text-xs">
            <div className="flex flex-wrap justify-between gap-2"><strong className="font-medium">{line.label}</strong><span className="tabular-nums">Difference {money(line.difference,comparison.currency)}</span></div>
            <p>{kinds[line.kind]}</p>
            <p className="text-muted-foreground">Planned {money(line.planned,comparison.currency)}{line.plannedDate&&" · "+line.plannedDate} / Recorded {money(line.actual,comparison.currency)}{line.actualDate&&" · "+line.actualDate}</p>
          </li>)}</ul>
          {!comparison.lines.length&&<p className="text-xs">No differences or dated changes recorded in this period yet.</p>}
          {comparison.lines.length>limit&&<Button variant="ghost" size="sm" onClick={()=>setLimit(n=>n+8)}>Show more differences</Button>}
          <p className="text-xs text-muted-foreground">Ledger corrections are separated from timing and amount differences. Additional recorded expenses may use the everyday allowance. Ambiguous matches remain unconfirmed. All differences above reconcile to the balance difference.</p>
        </section>}
      </div>
    </details>
  </div>;
}
