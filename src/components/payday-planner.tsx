"use client";
import {useState} from "react";
import {nextPayday,nextAnnualDue,type Cadence} from "@/lib/payday-model";
import type {planningMonth} from "@/lib/monthly-planning";
import {setPayday,setAnnualFund,removePlanningSchedule} from "@/lib/monthly-planning-actions";
import type {GoalDTO} from "@/lib/queries";
import {useFormat} from "./settings-provider";
import {Button} from "./ui/button";

type Book=Awaited<ReturnType<typeof planningMonth>>;
type Pay=Book["paydays"][number];
const field="mt-1 block min-h-9 w-full rounded-lg border bg-background px-2 text-sm";
export function PaydayPlanner({workspace,month,book,goals,canEdit,refresh,selectMonth}:{
  workspace:string;month:string;book:Book;goals:GoalDTO[];canEdit:boolean;refresh:()=>Promise<void>;selectMonth:(m:string)=>void;
}){
  const {balanceMoney}=useFormat(),money=(s:string)=>balanceMoney(Number(s));
  const [editing,setEditing]=useState(false),[account,setAccount]=useState(""),[start,setStart]=useState(""),[next,setNext]=useState("");
  const [cadence,setCadence]=useState<Cadence>("biweekly"),[expected,setExpected]=useState(""),[limit,setLimit]=useState(""),[version,setVersion]=useState(0);
  const [goal,setGoal]=useState(""),[due,setDue]=useState(""),[annualVersion,setAnnualVersion]=useState(0);
  const [busy,setBusy]=useState(false),[msg,setMsg]=useState(""),[error,setError]=useState("");
  const changeDate=(date:string,c:Cadence)=>{setStart(date);setCadence(c);setNext(nextPayday(date,c));};
  function edit(p?:Pay,following=false){
    const from=p?(following?p.next:p.start):(book.day.startsWith(month)?book.day:month+"-01");
    changeDate(from,p?.cadence??"biweekly");
    if(p&&!following)setNext(p.next);
    setAccount(p?.account??"");setExpected(p?.expected??"");setLimit(p?.limit??"");setVersion(following?0:p?.version??0);setEditing(true);
  }
  async function run(action:()=>ReturnType<typeof setPayday>,success:string,done:()=>void){
    setBusy(true);setError("");setMsg("");
    try{
      const result=await action();
      if(!result.ok){setError(result.error);return;}
      window.dispatchEvent(new Event("forecast-changed"));
      await refresh();setMsg(success);done();
    }catch{setError("Couldn’t confirm the change. Reopen the month to check the saved plan.");}
    finally{setBusy(false);}
  }
  const funding=book.accounts.find(a=>a.id===account);
  return <fieldset disabled={busy} className="space-y-4 border-t pt-3 text-sm">
    <section className="space-y-2"><h3 className="font-semibold">Payday budgets</h3>
      <p className="text-xs text-muted-foreground">Plan spending between two paydays on one account. Expected income is an estimate. Linked refunds reduce spending in the pay period when the credit arrived.</p>
      {!book.paydays.length&&<p>No pay periods cover this month.</p>}
      {book.paydays.map(p=><div key={p.account+p.start} className="space-y-1 rounded-lg border p-3 text-xs">
        <strong>{book.accounts.find(a=>a.id===p.account)?.name??"Inactive account"} · {p.start}</strong> · next payday {p.next}
        <p>Expected income {money(p.expected)} · Posted income {money(p.income)} · Spending limit {money(p.limit)}</p>
        <p>Posted expenses {money(p.spent)} · <strong>{money(p.remaining)} remaining in budget</strong></p>
        {canEdit&&<div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={()=>edit(p)}>Edit period</Button>
          <Button size="sm" variant="ghost" onClick={()=>edit(p,true)}>Plan next period</Button>
          <Button size="sm" variant="ghost" onClick={()=>void run(()=>removePlanningSchedule(workspace,{kind:"pay",...p}),"Pay period removed.",()=>setEditing(false))}>Remove period</Button>
        </div>}
      </div>)}
      {canEdit&&!editing&&<Button size="sm" variant="outline" onClick={()=>edit()}>Add pay period</Button>}
      {canEdit&&editing&&<div className="grid gap-2 rounded-lg border p-3 text-xs sm:grid-cols-3">
        <label>Pay account<select className={field} disabled={version>0} value={account} onChange={e=>setAccount(e.target.value)}><option value="">Choose account</option>{book.accounts.filter(a=>a.eligible).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        <label>Pay frequency<select className={field} value={cadence} onChange={e=>changeDate(start,e.target.value as Cadence)}>
          <option value="weekly">Weekly</option><option value="biweekly">Every two weeks</option><option value="irregular">Irregular dates</option></select></label>
        <label>First payday<input className={field} type="date" value={start} disabled={version>0} onInput={e=>changeDate(e.currentTarget.value,cadence)} onChange={e=>changeDate(e.target.value,cadence)}/></label>
        <label>Next payday<input className={field} type="date" value={next} readOnly={cadence!=="irregular"} onInput={e=>setNext(e.currentTarget.value)} onChange={e=>setNext(e.target.value)}/></label>
        <label>Expected income<input className={field} inputMode="decimal" value={expected} placeholder="0.00 if unknown" onChange={e=>setExpected(e.target.value)}/></label>
        <label>Period spending limit<input className={field} inputMode="decimal" value={limit} onChange={e=>setLimit(e.target.value)}/></label>
        {funding&&<p className="sm:col-span-3">Unreserved cash as of {book.day}: {money(funding.free)}. Expected income is excluded.</p>}
        <Button size="sm" disabled={!account||!start||next<=start||!limit} onClick={()=>void run(
          ()=>setPayday(workspace,{account,start,next,cadence,expected:expected||"0",limit,version}),"Pay period saved.",
          ()=>{setEditing(false);if(start.slice(0,7)>month||next<=month+"-01")selectMonth(start.slice(0,7));})}>Save pay period</Button>
        <Button size="sm" variant="ghost" onClick={()=>setEditing(false)}>Cancel</Button>
      </div>}
    </section>
    <section className="space-y-2 border-t pt-3"><h3 className="font-semibold">Annual sinking funds</h3>
      <p className="text-xs text-muted-foreground">Choose a savings goal for an annual expense. The monthly estimate divides the unfunded amount across the months from today through its due date, rounding up to the cent. Reserve cash using the goal controls above.</p>
      {book.annual.map(a=><div key={a.goal} className="rounded-lg border p-3 text-xs"><strong>{goals.find(g=>g.id===a.goal)?.name} · due {a.due}</strong>
        <p>Target {money(a.target)} · Reserved {money(a.reserved)} · Confirmed separate savings {money(a.outside)} · Still needed {money(a.gap)}</p>
        <p>{a.monthly===null?"Due date passed. Review the obligation before setting the next due date.":`${money(a.monthly)} per month across ${a.months} ${a.months===1?"month":"months"}.`}</p>
        {canEdit&&<div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" disabled={a.due>="2099-01-01"} onClick={()=>{
            setGoal(a.goal);setAnnualVersion(a.version);setDue(nextAnnualDue(a.due));setError("");setMsg("Review next year’s date below, then save it.");
          }}>Plan next year</Button>
          <Button size="sm" variant="ghost" onClick={()=>void run(()=>removePlanningSchedule(workspace,{kind:"annual",goal:a.goal,version:a.version}),
            "Schedule removed. Goal reservations are retained.",()=>setGoal(""))}>Remove schedule</Button></div>}
      </div>)}
      {!goals.length?<p>Create a savings goal to plan an annual expense.</p>:canEdit&&<div className="grid gap-2 text-xs sm:grid-cols-3">
        <label>Annual expense goal<select className={field} value={goal} onChange={e=>{const id=e.target.value,old=book.annual.find(a=>a.goal===id);setGoal(id);setAnnualVersion(old?.version??0);setDue(old?.due??goals.find(g=>g.id===id)?.deadline??"");}}>
          <option value="">Choose a goal</option>{goals.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
        <label>Annual bill due<input type="date" className={field} value={due} onInput={e=>setDue(e.currentTarget.value)} onChange={e=>setDue(e.target.value)}/></label>
        <Button size="sm" className="self-end" disabled={!goal||!due} onClick={()=>void run(()=>setAnnualFund(workspace,{goal,due,version:annualVersion}),"Annual fund schedule saved.",()=>setGoal(""))}>Save due date</Button>
      </div>}
    </section>
    {msg&&<p role="status">{msg}</p>}{error&&<p role="alert">{error}</p>}
  </fieldset>;
}
