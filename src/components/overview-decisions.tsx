"use client";

import {useEffect,useState} from "react";
import Link from "next/link";
import {ArrowUpRight,Bell,CalendarDays,Target} from "lucide-react";
import {loadDecisionOverview} from "@/lib/monthly-planning-actions";
import type {decisionOverview} from "@/lib/decision-overview";
import type {BudgetProgressDTO,CategoryDTO,RecurringDTO} from "@/lib/queries";
import {useFormat} from "./settings-provider";

type Outlook=Awaited<ReturnType<typeof decisionOverview>>;
type Item={title:string;detail:string;href:string};
const forecastHref="/?tab=planning#balance-forecast";
const planHref="/?tab=planning#monthly-plan";
const goalsHref="/?tab=planning#savings-goals";
const limitsHref="/?tab=planning#monthly-budgets";
const linkStyle="inline-flex items-center gap-1 rounded py-1 text-xs font-medium text-brand hover:underline focus-visible:outline-2";
function Jump({href,children}:{href:string;children:string}){
  return <Link className={linkStyle} href={href}>{children}<ArrowUpRight aria-hidden className="size-3.5"/></Link>;
}

export function OverviewDecisions({workspace,budgets,categories,recurring}:{
  workspace:string;budgets:BudgetProgressDTO[];categories:CategoryDTO[];recurring:RecurringDTO[];
}){
  const [data,setData]=useState<Outlook|null>(null),[revision,refresh]=useState(0),[error,setError]=useState("");
  const {money,balanceMoney,signedMoney}=useFormat();
  useEffect(()=>{
    const reload=()=>refresh(n=>n+1);
    window.addEventListener("ledger-changed",reload);window.addEventListener("forecast-changed",reload);
    return ()=>{window.removeEventListener("ledger-changed",reload);window.removeEventListener("forecast-changed",reload);};
  },[]);
  useEffect(()=>{
    let active=true;
    loadDecisionOverview(workspace).then(result=>{
      if(!active)return;
      if(result.ok){setData(result.value);setError("");}else setError(result.error);
    }).catch(()=>{if(active)setError("Couldn’t load your outlook.");});
    return ()=>{active=false;};
  },[workspace,revision,budgets]);
  if(error)return <div className="dashboard-panel p-4 text-sm" role="alert">{error} <button className={linkStyle} onClick={()=>refresh(n=>n+1)}>Try again</button></div>;
  if(!data)return <p role="status" className="dashboard-panel p-4 text-sm">Loading your household outlook…</p>;

  const amount=(value:string)=>balanceMoney(Number(value));
  const categoryName=(id:string)=>categories.find(c=>c.id===id)?.name??"Category";
  const alerts:Item[]=[];
  if(data.spendable!==null&&Number(data.spendable)<0)alerts.push({title:"Projected cash shortfall",detail:`${money(-Number(data.spendable))} below your buffer on ${data.lowDate}`,href:forecastHref});
  for(const b of data.coverage.bills)alerts.push({title:`Check ${b.label}`,detail:`Possible missing bill · ${b.accountName} · Around ${b.expected}`,href:`/accounts/${encodeURIComponent(b.account)}`});
  for(const a of data.coverage.accounts)alerts.push({title:a.name,detail:`Review account activity · Latest dated evidence ${[a.lastActivity,a.statementEnd].filter(Boolean).sort().at(-1)??"unavailable"}`,href:`/accounts/${encodeURIComponent(a.id)}`});
  if(data.missingAssumptions?.length)alerts.push({title:"Set spending and buffer assumptions",detail:data.missingAssumptions.join(", "),href:forecastHref});
  for(const r of recurring.filter(r=>r.nextDate<=data.start&&(!r.endDate||r.nextDate<=r.endDate)&&(r.maxOccurrences===null||r.occurrenceCount<r.maxOccurrences))){
    alerts.push({title:r.note||"Scheduled entry",detail:`Due ${r.nextDate} · ${money(r.amount)}`,href:"/?tab=planning#upcoming-payments"});
  }
  for(const b of budgets.filter(b=>b.budget>0&&b.spent/b.budget>=0.8).sort((a,b)=>b.spent/b.budget-a.spent/a.budget)){
    alerts.push({title:b.name,detail:`${Math.round(100*b.spent/b.budget)}% of monthly category limit used`,href:`/categories/${encodeURIComponent(b.categoryId)}`});
  }
  if(data.unreviewed)alerts.push({title:"Review opening savings",detail:`${data.unreviewed} ${data.unreviewed===1?"goal has":"goals have"} an unreviewed opening amount`,href:planHref});
  for(const warning of data.warnings)alerts.push({title:"Forecast assumption",detail:warning,href:forecastHref});
  const budgetRows=data.periods.map(p=>({name:categoryName(p.category),remaining:Number(p.remaining),href:planHref,id:p.category,kind:"Allocation"}));
  const planned=new Set(budgetRows.map(b=>b.id));
  for(const b of budgets)if(!planned.has(b.categoryId))budgetRows.push({name:b.name,remaining:b.budget-b.spent,href:limitsHref,id:b.categoryId,kind:"Category limit"});
  budgetRows.sort((a,b)=>a.remaining-b.remaining||a.name.localeCompare(b.name));
  const alertRow=(a:Item)=><Link key={a.href+a.title+a.detail} href={a.href} className="flex items-center justify-between gap-3 border-t py-2 hover:text-brand"><span><strong className="font-medium">{a.title}</strong><small className="block text-muted-foreground">{a.detail}</small></span><ArrowUpRight aria-hidden className="size-3.5 shrink-0"/></Link>;
  return <div className="space-y-4">
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section aria-labelledby="attention-inbox" className="dashboard-panel min-w-0 p-4 sm:p-5">
        <div className="mb-2 flex items-center gap-2"><Bell className="size-4 text-brand" aria-hidden/><h2 id="attention-inbox" className="text-sm font-semibold">Attention inbox</h2>
          <span className="ml-auto text-xs text-muted-foreground">{alerts.length} to review</span></div>
        <div className="text-sm">{alerts.slice(0,3).map(alertRow)}
          {alerts.length>3&&<details><summary className="cursor-pointer py-2 text-xs text-brand">View {alerts.length-3} more</summary>{alerts.slice(3).map(alertRow)}</details>}
          {!alerts.length&&<p className="border-t py-3 text-muted-foreground">No items flagged by the current checks.</p>}</div>
      </section>
      <section aria-labelledby="money-outlook" className="dashboard-panel min-w-0 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2"><CalendarDays aria-hidden className="size-4 text-brand"/><h2 id="money-outlook" className="text-sm font-semibold">Upcoming cash needs</h2><span className="ml-auto text-xs text-muted-foreground">30 days · Base</span></div>
        <p className="mt-1 text-xs text-muted-foreground">{data.start} through {data.end} · Updated {new Date(data.calculatedAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</p>
        <dl className="my-3 grid grid-cols-2 gap-3 border-y py-3 text-xs">
          <div><dt>Projected household balance</dt><dd className="amount text-lg font-semibold">{data.closing===null?"Unavailable":<Link className="underline decoration-dotted underline-offset-4" href="/?tab=planning&explain=closing#balance-forecast">{amount(data.closing)}</Link>}</dd></div>
          <div><dt>Lowest active cash balance</dt><dd className="amount text-lg font-semibold">{data.cashAccounts&&data.lowestCash!==null?<Link className="underline decoration-dotted underline-offset-4" href="/?tab=planning&explain=lowestCash#balance-forecast">{amount(data.lowestCash)}</Link>:"Unavailable"}</dd>{data.cashAccounts>0&&<small>{data.lowDate}</small>}</div>
        </dl>
        {data.spendable!==null&&<p className="mb-2 text-xs">{Number(data.spendable)<0?"Projected shortfall":"Available above the cash buffer"} · <Link className="amount text-brand underline" href="/?tab=planning&explain=spendable#balance-forecast">{money(Math.abs(Number(data.spendable)))}</Link></p>}
        {data.upcoming.map(e=><div key={e.key} className="flex justify-between gap-2 py-1 text-xs"><span>{e.label}<small className="block text-muted-foreground">{e.date} · {e.source} · {e.detail}</small></span><span className="amount">{signedMoney(Number(e.change))}{e.cashChange!==e.change&&<small className="block">Cash {signedMoney(Number(e.cashChange))}</small>}</span></div>)}
        {!data.upcomingCount&&<p className="text-xs text-muted-foreground">No dated payments, transfers or income in this period.</p>}
        <Jump href={forecastHref}>{data.upcomingCount>3?`Open forecast · ${data.upcomingCount} dated entries`:"Open forecast"}</Jump>
      </section>
    </div>
    <section aria-labelledby="budget-goal-progress" className="dashboard-panel p-4 sm:p-5">
      <div className="flex items-center gap-2"><Target className="size-4 text-brand" aria-hidden/><h2 id="budget-goal-progress" className="text-sm font-semibold">Budget and goal progress</h2></div>
      <div className="mt-3 grid gap-4 border-t pt-3 sm:grid-cols-2">
        <div><h3 className="text-xs font-semibold">Category budgets · {data.month}</h3>
          {budgetRows.slice(0,3).map(b=><Link key={b.id} href={b.href} className="flex justify-between gap-2 py-1.5 text-xs hover:text-brand"><span>{b.name}<small className="block text-muted-foreground">{b.kind}</small></span><span className={b.remaining<0?"amount text-negative":"amount"}>{money(Math.abs(b.remaining))} {b.remaining<0?"over":"left"}</span></Link>)}
          {!budgetRows.length&&<p className="py-2 text-xs text-muted-foreground">No category budgets set for this month.</p>}
          <div className="flex flex-wrap gap-x-3">{(data.periods.length>0||!budgets.length)&&<Jump href={planHref}>View monthly plan</Jump>}{budgets.length>0&&<Jump href={limitsHref}>View category limits</Jump>}</div></div>
        <div><h3 className="text-xs font-semibold">Savings goals · Confirmed progress</h3>
          {data.goals.slice(0,3).map(g=><div key={g.id} className="py-1.5 text-xs"><div className="flex justify-between gap-2"><span>{g.name}</span><span className="amount">{amount(g.confirmed)} of {amount(g.target)}</span></div>
            <progress aria-label={g.name} className="mt-1 h-1 w-full accent-brand" max={Number(g.target)||1} value={Math.min(Number(g.target),Number(g.confirmed))}/></div>)}
          {!data.goals.length&&<p className="py-2 text-xs text-muted-foreground">No savings goals set yet.</p>}<Jump href={goalsHref}>View goals</Jump></div>
      </div>
    </section>
  </div>;
}
