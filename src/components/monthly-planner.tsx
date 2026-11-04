"use client";
import {useEffect,useRef,useState} from "react";
import {loadMonth,setMonthlyPlan,allocateToGoal,moveMonthlyBudget} from "@/lib/monthly-planning-actions";
import type {planningMonth} from "@/lib/monthly-planning";
import type {CategoryDTO,BudgetProgressDTO,GoalDTO} from "@/lib/queries";
import {todayISO} from "@/lib/dates";
import {useFormat} from "./settings-provider";
import {Button} from "./ui/button";
import {GoalOpeningReview} from "./goal-opening-review";
import {PaydayPlanner} from "./payday-planner";

type Book=Awaited<ReturnType<typeof planningMonth>>;
type Props={workspace:string;categories:CategoryDTO[];budgets:BudgetProgressDTO[];goals:GoalDTO[];canEdit:boolean};
const field="mt-1 block min-h-9 w-full rounded-lg border bg-background px-2 text-sm";
export function MonthlyPlanner(props:Props){
  const [month,setMonth]=useState(todayISO().slice(0,7));
  function selectMonth(value:string){
    if(/^\d{4}-(0[1-9]|1[0-2])$/.test(value)&&value>="1900-01"&&value<="2099-12")setMonth(value);
  }
  function step(delta:number){
    const [year,m]=month.split("-").map(Number);
    const next=new Date(Date.UTC(year,m-1+delta,1)).toISOString().slice(0,7);
    selectMonth(next);
  }
  return <section className="dashboard-panel space-y-3 p-4" id="monthly-plan">
    <header className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-semibold">Monthly plan</h2>
      <p className="text-xs text-muted-foreground">Plan category spending and set aside cash for goals.</p></div>
      <div className="flex items-end gap-1"><Button size="sm" variant="ghost" aria-label="Previous budget month" onClick={()=>step(-1)}>←</Button>
        <label className="text-xs">Budget month<input className={field} type="month" value={month} min="1900-01" max="2099-12"
          onInput={e=>selectMonth(e.currentTarget.value)} onChange={e=>selectMonth(e.target.value)}/></label>
        <Button size="sm" variant="ghost" aria-label="Next budget month" onClick={()=>step(1)}>→</Button></div></header>
    <MonthBody key={props.workspace+month} {...props} month={month} selectMonth={selectMonth}/>
  </section>;
}
function MonthBody({workspace,month,categories,budgets,goals,canEdit,selectMonth}:Props&{month:string;selectMonth:(m:string)=>void}){
  const {balanceMoney:money}=useFormat(),[book,setBook]=useState<Book|null>(null),[error,setError]=useState(""),[msg,setMsg]=useState("");
  const [reload,setReload]=useState(0),[edit,setEdit]=useState(""),[busy,setBusy]=useState(false);
  const [amount,setAmount]=useState(""),[roll,setRoll]=useState(true);
  const [account,setAccount]=useState(""),[goal,setGoal]=useState(""),[cash,setCash]=useState(""),[release,setRelease]=useState(false);
  const request=useRef<{payload:string;id:string}|null>(null);
  const [source,setSource]=useState(""),[destination,setDestination]=useState("");
  const [moveAmount,setMoveAmount]=useState(""),[moveNote,setMoveNote]=useState("");
  const moveRequest=useRef<{payload:string;id:string}|null>(null);
  const categoryName=(id:string)=>categories.find(c=>c.id===id)?.name??"Unknown category";
  useEffect(()=>{
    const reloadLedger=()=>setReload(n=>n+1);
    window.addEventListener("ledger-changed",reloadLedger);
    return ()=>window.removeEventListener("ledger-changed",reloadLedger);
  },[]);
  useEffect(()=>{
    let active=true;loadMonth(workspace,month).then(r=>{
      if(!active)return;
      if(r.ok){setBook(r.value);setError("");}else setError(r.error);
    }).catch(()=>{if(active)setError("Couldn’t load the plan.");});
    return ()=>{active=false;};
  },[workspace,month,reload]);
  const plan=book?.periods.find(p=>p.category===edit);
  const selected=book?.accounts.find(a=>a.id===account);
  const selectedGoal=book?.progress.find(g=>g.id===goal);
  const held=book?.held.find(h=>h.account===account&&h.goal===goal);
  function choose(id:string){
    setEdit(id);const p=book?.periods.find(row=>row.category===id);
    setAmount(p?.base??budgets.find(b=>b.categoryId===id)?.budget.toString()??"");setRoll(p?.rollover??true);
  }
  async function save(mode:"budget"|"cash"|"move"){
    if(busy)return;setBusy(true);setError("");setMsg("");
    try{
      let result;
      if(mode==="budget")result=await setMonthlyPlan(workspace,{month,category:edit,amount,rollover:roll,version:plan?.version??0});
      else if(mode==="move"){
        const data={month,source,destination,amount:moveAmount,note:moveNote};
        const payload=JSON.stringify(data);
        if(moveRequest.current?.payload!==payload)moveRequest.current={id:crypto.randomUUID(),payload};
        result=await moveMonthlyBudget(workspace,{...data,id:moveRequest.current.id});
      }else{
        const payload=JSON.stringify([account,goal,cash,release]);
        if(request.current?.payload!==payload)request.current={payload,id:crypto.randomUUID()};
        result=await allocateToGoal(workspace,{id:request.current.id,account,goal,amount:cash,release});
      }
      if(!result.ok){setError(result.error);return;}
      if(mode==="budget")setEdit("");
      else if(mode==="move"){moveRequest.current=null;setMoveAmount("");setMoveNote("");}
      else{request.current=null;setCash("");window.dispatchEvent(new Event("ledger-changed"));}
      setMsg(mode==="move"?"Budget move recorded.":mode==="budget"?"Monthly allocation saved.":release?"Cash released.":"Cash reserved for the goal.");
      const updated=await loadMonth(workspace,month);
      if(updated.ok)setBook(updated.value);else setError(updated.error);
    }catch{setError("Couldn’t confirm the save. Reload to check the plan.");}
    finally{setBusy(false);}
  }
  return <div className="space-y-4 text-sm">
    {error&&<p role="alert">{error} <button className="text-brand" onClick={()=>{setEdit("");setReload(r=>r+1);}}>Reload</button></p>}
    {msg&&<p role="status">{msg}</p>}
    {!book?<p>Loading plan…</p>:<>
      <p className="text-xs text-muted-foreground">Allocations repeat from the selected month. Rollover carries surplus or overspending forward. Spending includes posted expenses through {book.day}. Linked refunds reduce the original category’s spending in the month the credit arrived. Editing a past amount recalculates that month and any rollover carried forward.</p>
      {book.periods.length?<div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr>
        {["Category","Monthly allocation","Carried in","Moved in / out","Posted spending","Remaining"].map(c=><th className="p-1.5" key={c}>{c}</th>)}
      </tr></thead><tbody>{book.periods.map(p=><tr className="border-t" key={p.category}>
        <th className="p-1.5">{categories.find(c=>c.id===p.category)?.name}<small className="block font-normal">{p.rollover?"Rolls over":"Resets next month"}</small></th>
        {[p.base,p.carry,p.moved,p.spent,p.remaining].map((v,i)=><td className="p-1.5 tabular-nums" key={i}>{money(Number(v))}</td>)}</tr>)}</tbody></table></div>
        :<p>No category allocations for this month.</p>}
      {canEdit&&<fieldset disabled={busy} className="grid gap-2 sm:grid-cols-3"><label className="text-xs">Plan category<select className={field} value={edit} onChange={e=>choose(e.target.value)}>
        <option value="">Choose a category</option>{categories.filter(c=>c.kind==="expense").map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        {edit&&<><label className="text-xs">Monthly allocation<input className={field} value={amount} inputMode="decimal" onChange={e=>setAmount(e.target.value)}/></label>
        <label className="self-center"><input type="checkbox" checked={roll} onChange={e=>setRoll(e.target.checked)}/> Roll over the remainder</label>
        {!plan&&budgets.some(b=>b.categoryId===edit)&&<p className="text-xs text-muted-foreground sm:col-span-3">Starting amount copied from your current spending limit. Saving starts the plan in {month}.</p>}
        <Button size="sm" onClick={()=>void save("budget")} disabled={!amount}>Save monthly allocation</Button></>}
      </fieldset>}
      <div className="space-y-2 border-t pt-3">
        <h3 className="font-semibold">Move budget between categories</h3>
        <p className="text-xs text-muted-foreground">Move part of one category’s remainder to another for {month}. Each category’s rollover rule applies afterward.</p>
        {canEdit&&(book.periods.length<2?<p className="text-xs">Set allocations for two categories to make a move.</p>:
          <form onSubmit={e=>{e.preventDefault();void save("move");}}>
            <fieldset disabled={busy} className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs">Move from<select required className={field} value={source} onChange={e=>{
                setSource(e.target.value);if(destination===e.target.value)setDestination("");
              }}><option value="">Choose a funded category</option>{book.periods.filter(p=>Number(p.remaining)>0).map(p=>
                <option key={p.category} value={p.category}>{categoryName(p.category)} · {money(Number(p.remaining))} available</option>)}</select></label>
              <label className="text-xs">Move to<select required className={field} value={destination} onChange={e=>setDestination(e.target.value)}>
                <option value="">Choose a category</option>{book.periods.filter(p=>p.category!==source).map(p=><option key={p.category} value={p.category}>{categoryName(p.category)}</option>)}</select></label>
              <label className="text-xs">Amount to move<input required type="number" min="0.01" step="0.01" max={book.periods.find(p=>p.category===source)?.remaining}
                className={field} value={moveAmount} onChange={e=>setMoveAmount(e.target.value)}/></label>
              <label className="text-xs">Note (optional)<input className={field} maxLength={200} value={moveNote} onChange={e=>setMoveNote(e.target.value)}/></label>
              <Button type="submit" size="sm" disabled={!source||!destination||!moveAmount} className="justify-self-start">Move budget</Button>
            </fieldset>
          </form>)}
        <details className="text-xs"><summary className="cursor-pointer py-1 font-medium">Move history ({book.moves.length})</summary>
          {book.moves.length?<ul className="divide-y">{book.moves.map(m=><li key={m.id} className="py-2">
            <strong>{categoryName(m.source)} → {categoryName(m.destination)} · {money(Number(m.amount))}</strong>
            <div className="text-muted-foreground">{m.actor} · {m.created} UTC</div>{m.note&&<p className="break-words">{m.note}</p>}
          </li>)}</ul>:<p>No budget moves recorded for this month.</p>}</details>
      </div>
      <div id="goal-cash-reservations" className="space-y-2 border-t pt-3"><h3 className="font-semibold">Cash reserved for goals</h3>
        <p className="text-xs text-muted-foreground">Based on posted balances through {book.day}. Reserving or releasing cash changes how it is earmarked inside the account.</p>
        {book.accounts.map(a=><p className="text-xs" key={a.id}><strong>{a.name}</strong> · {money(Number(a.reserved))} reserved · {money(Number(a.free))} {Number(a.free)<0?"unreserved (shortfall)":"unreserved"}</p>)}
        {book.held.map(h=><p className="text-xs" key={h.account+h.goal}>{goals.find(g=>g.id===h.goal)?.name} · {book.accounts.find(a=>a.id===h.account)?.name} · {money(Number(h.amount))} reserved</p>)}
        {!goals.length&&<p>Create a savings goal below to reserve cash for it.</p>}
        {canEdit&&goals.length>0&&<fieldset disabled={busy} className="grid gap-2 sm:grid-cols-3">
          <label className="text-xs">Funding account<select className={field} value={account} onChange={e=>setAccount(e.target.value)}><option value="">Choose an account</option>{book.accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
          <label className="text-xs">Savings goal<select className={field} value={goal} onChange={e=>setGoal(e.target.value)}><option value="">Choose a goal</option>{goals.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
          <label className="text-xs">Allocation amount<input className={field} inputMode="decimal" value={cash} onChange={e=>setCash(e.target.value)}/></label>
          <label className="text-xs"><input type="checkbox" checked={release} onChange={e=>setRelease(e.target.checked)}/> Release existing reservation</label>
          {selectedGoal&&Number(selectedGoal.outside)>0&&!release&&<p className="text-xs text-muted-foreground sm:col-span-3">
            This goal includes {money(Number(selectedGoal.outside))} in separate savings. If you deposited those funds into this account, <a className="underline" href="#goal-opening-review">revise the opening amount</a> before reserving them here.
          </p>}
          <Button size="sm" disabled={!goal||!cash||!selected||(release?!held:!selected.eligible)} onClick={()=>void save("cash")}>{release?"Release cash":"Reserve cash"}</Button>
        </fieldset>}
      </div>
      <GoalOpeningReview workspace={workspace} progress={book.progress} canEdit={canEdit} refresh={()=>setReload(r=>r+1)}/>
      <PaydayPlanner workspace={workspace} month={month} book={book} goals={goals} canEdit={canEdit} selectMonth={selectMonth}
        refresh={async()=>{const updated=await loadMonth(workspace,month);if(!updated.ok)throw Error(updated.error);setBook(updated.value);}}/>
    </>}
  </div>;
}
