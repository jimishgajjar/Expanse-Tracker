"use client";
import Link from "next/link";
import {useState} from "react";
import {useFormat} from "./settings-provider";
import {explainForecast,type ForecastMetric} from "@/lib/forecast-explanation";
import type {forecastBalances} from "@/lib/balance-forecast";

export function ForecastExplanation({data,metric,onClose}:{data:Awaited<ReturnType<typeof forecastBalances>>;metric:ForecastMetric;onClose:()=>void}){
  const explanation=explainForecast(data,metric);
  const [limit,setLimit]=useState(10);
  const {balanceMoney,signedMoney}=useFormat();
  if(!explanation)return null;
  return <section id="forecast-explanation" aria-label="Forecast calculation" className="space-y-2 rounded-lg border bg-muted/20 p-3">
    <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{explanation.title} · Calculation</h3>
      <button type="button" className="text-brand underline" onClick={onClose}>Close calculation</button></div>
    <p className="text-muted-foreground">Through {explanation.date}. Expand a line to see the amounts and their sources.</p>
    {data.paydayPlan&&<p>Payday horizon {data.paydayPlan.date} · {data.openingAccounts.find(a=>a.id===data.paydayPlan?.account)?.name} pay period {data.paydayPlan.start} to {data.paydayPlan.next}.</p>}
    {explanation.groups.slice(0,limit).map((g,i)=><details key={g.label} className="border-t pt-2" open={i===0||undefined}>
      <summary className="cursor-pointer"><span>{g.label}</span> <strong className="amount float-right">{signedMoney(Number(g.amount))}</strong></summary>
      <ul className="space-y-2 py-2 pl-3">{g.lines.map((line,j)=><li key={j} className="flex justify-between gap-3">
        <span>{line.href.startsWith("#")?<a className="text-brand underline" href={line.href}>{line.label}</a>:<Link className="text-brand underline" href={line.href}>{line.label}</Link>}<small className="block text-muted-foreground">{line.detail}</small>
          {line.initial!==undefined&&line.movement!==undefined&&<small className="block">Opening {balanceMoney(Number(line.initial))} · Net movements {signedMoney(Number(line.movement))}</small>}
          {line.matchedSchedule&&<a className="text-brand underline" href={line.matchedSchedule}>Matching schedule · counted once</a>}</span>
        <span className="amount">{signedMoney(Number(line.amount))}</span>
      </li>)}</ul>
    </details>)}
    {explanation.groups.length>limit&&<button type="button" className="text-brand underline" onClick={()=>setLimit(n=>n+10)}>Show more calculation lines ({explanation.groups.length-limit} remaining)</button>}
    <div className="flex justify-between border-t pt-2 font-semibold"><span>Result</span><span className="amount">{balanceMoney(Number(explanation.result))}</span></div>
  </section>;
}
