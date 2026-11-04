"use client";
import Link from "next/link";
import {useSearchParams} from "next/navigation";
import {ForecastExplanation} from "./forecast-explanation";
import {forecastMetrics,isForecastMetric,type ForecastMetric} from "@/lib/forecast-explanation";
import {useEffect,useState} from "react";
import type {ScenarioName} from "@/lib/forecast-scenario";
import {loadBalanceForecast,setForecastScenario} from "@/lib/monthly-planning-actions";
import type {forecastBalances} from "@/lib/balance-forecast";
import type {AccountDTO} from "@/lib/queries";
import {useFormat} from "./settings-provider";
import {Button} from "./ui/button";

type Forecast=Awaited<ReturnType<typeof forecastBalances>>;
const control="mt-1 block min-h-9 w-full rounded-lg border bg-background px-2 text-sm";

export function BalanceForecast({workspace,accounts,canEdit}:{workspace:string;accounts:AccountDTO[];canEdit:boolean}){
  const [account,setAccount]=useState(""),[horizon,setHorizon]=useState("30");
  const [scenario,setScenario]=useState<ScenarioName>("base");
  const [usePay,setUsePay]=useState(false);
  const includeExpectedPay=scenario==="base"&&usePay;
  return <section className="dashboard-panel space-y-3 p-4" id="balance-forecast">
    <header><h2 className="text-sm font-semibold">Balance forecast</h2>
      <p className="text-xs text-muted-foreground">Follow your balance from today through upcoming entries and scheduled payments.</p></header>
    <div className="grid gap-2 sm:grid-cols-3">
      <label className="text-xs">Forecast accounts<select className={control} value={account} onChange={e=>setAccount(e.target.value)}>
        <option value="">Household · all tracked accounts</option>{accounts.map(a=><option value={a.id} key={a.id}>{a.name}{a.archived?" (archived)":""}</option>)}</select></label>
      <label className="text-xs">Forecast period<select className={control} value={horizon} onChange={e=>setHorizon(e.target.value)}>
        <option value="payday">Through next payday</option>{["30","60","90"].map(n=><option key={n} value={n}>Next {n} days</option>)}</select></label>
      <label className="text-xs">Forecast scenario<select className={control} value={scenario} onChange={e=>setScenario(e.target.value==="base"?"base":"conservative")}>
        <option value="base">Base</option><option value="conservative">Conservative</option></select></label>
    </div>
    {scenario==="base"&&<label className="flex items-start gap-2 text-xs">
      <input type="checkbox" checked={usePay} onChange={e=>setUsePay(e.target.checked)}/>
      <span>Include remaining expected pay <small className="block text-muted-foreground">Estimate any uncovered income on the last day of each saved pay period.</small></span>
    </label>}
    <ForecastResult key={JSON.stringify([workspace,account,horizon,scenario,includeExpectedPay])} workspace={workspace} account={account} horizon={horizon} scenario={scenario} includeExpectedPay={includeExpectedPay} canEdit={canEdit}/>
  </section>;
}

function ForecastResult({workspace,account,horizon,scenario,includeExpectedPay,canEdit}:{workspace:string;account:string;horizon:string;scenario:ScenarioName;includeExpectedPay:boolean;canEdit:boolean}){
  const requested=useSearchParams().get("explain");
  const [metric,setMetric]=useState<ForecastMetric|null>(isForecastMetric(requested)?requested:null);
  const [data,setData]=useState<Forecast|null>(null),[error,setError]=useState(""),[revision,reload]=useState(0);
  const [limit,setLimit]=useState(10),[saved,setSaved]=useState("");
  const {balanceMoney}=useFormat(),money=(value:string)=>balanceMoney(Number(value));
  useEffect(()=>{
    function refresh(){reload(n=>n+1);}
    window.addEventListener("forecast-changed",refresh);
    window.addEventListener("ledger-changed",refresh);
    return ()=>{window.removeEventListener("ledger-changed",refresh);window.removeEventListener("forecast-changed",refresh);};
  },[]);
  useEffect(()=>{
    let active=true;
    loadBalanceForecast(workspace,{account:account||null,horizon,scenario,includeExpectedPay}).then(result=>{
      if(!active)return;
      if(result.ok){setData(result.value);setError("");}
      else setError(result.error);
    }).catch(()=>{if(active)setError("Couldn’t load the forecast.");});
    return ()=>{active=false;};
  },[workspace,account,horizon,scenario,includeExpectedPay,revision]);
  if(error)return <p role="alert" className="text-sm">{error} <button className="underline" onClick={()=>reload(n=>n+1)}>Retry</button></p>;
  if(!data)return <p role="status" className="text-xs">Calculating forecast…</p>;
  const p=data.projection;
  const explain=(value:ForecastMetric)=><button type="button" className="block py-1 text-brand underline" aria-label={`Explain ${forecastMetrics[value]}`}
    aria-expanded={metric===value} onClick={()=>setMetric(metric===value?null:value)}>Explain</button>;
  return <div className="space-y-3 text-xs">
    <p className="text-muted-foreground">{data.start}{data.end&&" through "+data.end} · Calculated {new Date(data.calculatedAt).toLocaleTimeString()} <button className="ml-2 text-brand underline" onClick={()=>reload(n=>n+1)}>Recalculate</button></p>
    {p&&<>
      <dl className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-4">
        <div><dt>Balance today</dt><dd className="amount font-semibold">{money(data.opening)}{explain("opening")}</dd></div>
        <div><dt>Estimated closing balance</dt><dd className="amount font-semibold">{money(p.closing)}{explain("closing")}</dd></div>
        <div><dt>Lowest end-of-day balance</dt><dd className="amount font-semibold">{money(p.lowest)} <span className="font-normal text-muted-foreground">· {p.lowDate}</span>{explain("lowest")}</dd></div>
        {data.assumptions.length>0&&<div><dt>Lowest active cash balance</dt><dd className="amount font-semibold">{money(p.lowestCash)} <span className="font-normal text-muted-foreground">· {p.cashLowDate}</span>{explain("lowestCash")}</dd></div>}
      </dl>
      {p.spendable!==null?<div className="rounded-lg border p-3">
        <strong>{Number(p.spendable)<0?"Projected cash shortfall":"Estimated extra spending available"} · {money(p.spendable)}</strong>
        <p className="mt-1 text-muted-foreground">Lowest active cash balance {money(p.lowestCash)} on {p.cashLowDate}, less {money(data.reserved)} reserved for goals and {money(data.buffer)} kept as a buffer.</p>
        {explain("spendable")}
      </div>:<p>{data.assumptions.length?"Confirm everyday spending and buffer amounts for each active cash account to see the spending estimate.":"Spending estimates apply to active cash, bank, savings and wallet accounts."}</p>}
      {metric&&<ForecastExplanation key={metric} data={data} metric={metric} onClose={()=>setMetric(null)}/>}
      <details><summary className="cursor-pointer py-1 font-medium">Projected changes · {p.days.length} {p.days.length===1?"dated group":"dated groups"}</summary>
        {p.days.length===0&&<p>No dated changes found in this period.</p>}
        {p.days.slice(0,limit).map(d=><div key={d.date} className="border-t py-2">
          <div className="flex justify-between gap-2 font-semibold"><span>{d.date}</span><span>Closing {money(d.balance)}</span></div>
          <ul>{d.events.map(e=><li key={e.key} className="flex justify-between gap-2 py-1">
            <span><Link className="text-brand underline" href={e.href}>{e.label}</Link><small className="block text-muted-foreground">{e.source} · {e.detail}{e.change!==e.cashChange&&" · Cash impact "+money(e.cashChange)}{e.overlap&&" · Possible schedule match, counted once"}</small></span>
            <span className="tabular-nums">{money(e.change)}</span></li>)}</ul>
        </div>)}
        {p.days.length>limit&&<Button size="sm" variant="ghost" onClick={()=>setLimit(n=>n+10)}>Show more dates</Button>}
      </details>
    </>}
    <Coverage forecast={data}/>
    {includeExpectedPay&&data.end&&<section id="forecast-pay-estimates" className="space-y-1 border-t pt-2">
      <h3 className="font-semibold">Expected pay reconciliation</h3>
      <p className="text-muted-foreground">The target covers all income for the account during this period. Linked refunds are excluded. The remainder is a what-if estimate, and the deposit date may differ.</p>
      {data.payEstimates.length===0?<p>No active pay periods with expected income end inside this forecast.</p>:
        data.payEstimates.map(plan=><div key={plan.account+plan.first} id={`pay-estimate-${plan.account}-${plan.first}`} className="py-1">
          <strong>{plan.name} · {plan.first} through {plan.date}</strong>
          <p>Expected {money(plan.expected)} · Recorded income {money(plan.recorded)} · Additional scheduled income {money(plan.scheduled)} · Estimated remainder {money(plan.remainder)}</p>
        </div>)}
    </section>}
    {data.assumptions.length>0&&<details><summary className="cursor-pointer py-1 font-medium">Scenario settings · {money(data.daily)}/day · {money(data.buffer)} buffer</summary>
      <p id="forecast-setting-list" className="my-2 text-muted-foreground">Enter additional everyday spending from tomorrow, excluding anything already in the ledger or bills. The buffer is cash to keep on hand throughout the period. Enter 0 to confirm either amount is zero.</p>
      {scenario==="conservative"&&<p className="my-2">Conservative uses at least each account’s base settings and excludes unrecorded scheduled income.</p>}
      {data.assumptions.map(a=><ScenarioAccount key={JSON.stringify([a.id,a.version,a.daily,a.buffer])} setting={a} workspace={workspace} scenario={scenario} canEdit={canEdit} refresh={didSave=>{setSaved(didSave?"Saved assumptions for "+a.name+".":"");reload(n=>n+1);}}/>)}
      {saved&&<p role="status">{saved}</p>}
    </details>}
    {data.warnings.map(w=><p key={w} className="text-muted-foreground">{w}</p>)}
    <details><summary className="cursor-pointer py-1">Forecast assumptions</summary>
      <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
        <li>The opening balance includes initial balances, dated account entries and transfers through today. Household totals include archived accounts. Entries without an account are excluded.</li>
        <li>Future ledger entries use their recorded amounts. Recurring entries use their current schedule and amount. Variable bills are estimates.</li>
        <li>A ledger entry with the same account, date, direction, amount, category and note can cover one scheduled occurrence. Other manual entries may overlap.</li>
        <li>The next payday is the earliest future date in the selected pay plans. Base can include the remainder of a period’s income target after recorded income (excluding linked refunds) and additional scheduled income. Conservative excludes this estimate.</li>
        <li>Transfers into a tracked card move money between accounts. An installment schedule with the same paying account, date, amount and nonempty note can be covered by one such transfer. An unmatched installment projects an expense on the paying account.</li>
        <li>Everyday estimates reduce the projected balance each day. Today’s goal reservations and buffers are held constant and deducted once when calculating extra spending available. Household cash estimates pool active cash accounts and assume you can move money between them.</li>
      </ul>
    </details>
  </div>;
}

function Coverage({forecast}:{forecast:Forecast}){
  const {accountCount,accounts,bills}=forecast.coverage;
  const {money}=useFormat();
  const count=accounts.length+bills.length;
  return <details className="rounded-lg border px-3 py-2">
    <summary className="cursor-pointer font-medium">Forecast coverage · {count?`${count} ${count===1?"item":"items"} to review`:accountCount?(forecast.end?"No gaps flagged":"No account freshness flags"):"No active accounts in view"}{!forecast.end&&" · Bill check unavailable"}</summary>
    <div className="mt-2 space-y-2">
      {accounts.map(a=><div key={a.id} className="border-t pt-2">
        <strong>{a.name} · {a.lastActivity||a.statementEnd?"No recent account activity or statement":"No dated account history"}</strong>
        <p>Latest ledger activity: {a.lastActivity??"none recorded"}. Latest completed statement period: {a.statementEnd??"none recorded"}.</p>
        <Link className="text-brand underline" href={`/accounts/${encodeURIComponent(a.id)}`}>Review account activity</Link>
      </div>)}
      {bills.map(b=><div key={JSON.stringify([b.account,b.label])} className="border-t pt-2">
        <strong>Possible missing bill · {b.label}</strong>
        <p>{b.accountName} · Expected around {b.expected}. Check whether this payment still applies.</p>
        <p className="text-muted-foreground">Previous payments: {b.history.map(h=>h.date+" ("+money(Number(h.amount))+")").join(" · ")}</p>
        <Link className="text-brand underline" href={`/accounts/${encodeURIComponent(b.account)}`}>Review payments</Link>{" · "}
        <a className="text-brand underline" href="#upcoming-payments">View bill schedules</a>
      </div>)}
      <p className="text-muted-foreground">Active accounts are flagged after 30 days without a dated entry, transfer or completed statement period. Quiet accounts can still be up to date.</p>
      {forecast.end?<p className="text-muted-foreground">Bill hints look for a similarly timed and priced expense in three consecutive months on the same account. Named schedules and nearby dated payments are checked first. Hints do not change the forecast. New or irregular bills may be missed.</p>:
        <p className="text-muted-foreground">Select a dated forecast period to check for missing bills.</p>}
    </div>
  </details>;
}

function ScenarioAccount({setting,workspace,scenario,canEdit,refresh}:{
  setting:Forecast["assumptions"][number];workspace:string;scenario:ScenarioName;canEdit:boolean;refresh:(saved:boolean)=>void;
}){
  const {money}=useFormat();
  const [editing,setEditing]=useState(false),[daily,setDaily]=useState(setting.daily),[buffer,setBuffer]=useState(setting.buffer);
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  async function save(e:React.FormEvent){
    e.preventDefault();
    if(busy)return;
    setBusy(true);setError("");
    try{
      const result=await setForecastScenario(workspace,{account:setting.id,scenario,version:setting.version,daily,buffer});
      if(!result.ok){setError(result.error);return;}
      setEditing(false);refresh(true);
    }catch{setError("Couldn’t confirm the save. Reload to check your settings.");}
    finally{setBusy(false);}
  }
  return <div className="space-y-2 border-t py-2">
    <p><strong>{setting.name}</strong> · {setting.configured?`${money(Number(setting.daily))}/day · ${money(Number(setting.buffer))} buffer`:"Assumptions not set"}
      {scenario==="conservative"&&setting.version===0&&setting.configured&&" · Using base settings"}</p>
    {canEdit&&(editing?<form onSubmit={save} className="grid items-end gap-2 sm:grid-cols-3">
      <label>Additional daily spending<input className={control} required type="number" step="0.01" min={setting.minimumDaily} value={daily} onChange={e=>setDaily(e.target.value)}/></label>
      <label>Cash buffer<input className={control} required type="number" step="0.01" min={setting.minimumBuffer} value={buffer} onChange={e=>setBuffer(e.target.value)}/></label>
      <div><Button type="submit" disabled={busy} size="sm">Save assumptions</Button> <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={()=>setEditing(false)}>Cancel</Button></div>
      {error&&<p role="alert">{error} <button type="button" className="underline" onClick={()=>{setEditing(false);refresh(false);}}>Reload</button></p>}
    </form>:<Button size="sm" variant="outline" onClick={()=>{setDaily(setting.daily);setBuffer(setting.buffer);setError("");setEditing(true);}}>Edit {setting.name} assumptions</Button>)}
  </div>;
}
