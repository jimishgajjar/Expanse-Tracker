import type {forecastBalances} from "./balance-forecast";
import {decimalMoney,moneyCents} from "./statement-review";

export const forecastMetrics={
  opening:"Balance today", closing:"Estimated closing balance", lowest:"Lowest end-of-day balance",
  lowestCash:"Lowest active cash balance", spendable:"Cash after reservations and buffer",
} as const;
export type ForecastMetric=keyof typeof forecastMetrics;
export function isForecastMetric(value:string|null):value is ForecastMetric{
  return value!==null&&Object.hasOwn(forecastMetrics,value);
}
type Line={label:string;detail:string;amount:string;href:string;matchedSchedule?:string;initial?:string;movement?:string};
type Group={label:string;amount:string;lines:Line[]};

// Read the same snapshot as the headline. A low-water mark includes movements only
// through its first low date. Cash-only metrics use the cash leg of each transfer.
export function explainForecast(data:Awaited<ReturnType<typeof forecastBalances>>,metric:ForecastMetric){
  const p=data.projection;
  if(!p)return null;
  const cash=metric==="lowestCash"||metric==="spendable";
  if((cash&&!data.assumptions.length)||(metric==="spendable"&&p.spendable===null))return null;
  const date=cash?p.cashLowDate:metric==="lowest"?p.lowDate:metric==="opening"?data.start:data.end!;
  const groups:Group[]=[];
  function group(label:string,lines:Line[]){
    if(lines.length)groups.push({label,lines,amount:decimalMoney(lines.reduce((sum,line)=>sum+moneyCents(line.amount),BigInt(0)))});
  }
  group(cash?"Active cash accounts at the start":"Accounts at the start",data.openingAccounts.filter(a=>!cash||a.eligible).map(a=>({
    label:a.name,detail:"Account opening amount and net ledger movements through "+data.start,amount:a.opening,
    href:"/accounts/"+encodeURIComponent(a.id),initial:a.initial,movement:a.movement,
  })));
  if(metric!=="opening"){
    for(const day of p.days){
      if(day.date>date)break;
      group(day.date,day.events.map(e=>({label:e.label,amount:cash?e.cashChange:e.change,detail:e.source+" · "+e.detail,href:e.href,matchedSchedule:e.matchedSchedule})));
    }
  }
  if(metric==="spendable"){
    group("Cash reserved for goals",data.reservations.map(r=>({label:r.name,detail:data.openingAccounts.find(a=>a.id===r.account)?.name??"Account",
      amount:decimalMoney(-moneyCents(r.amount)),href:"#goal-cash-reservations"})));
    group("Cash buffers",data.assumptions.map(a=>({label:a.name,detail:"Scenario setting",amount:decimalMoney(-moneyCents(a.buffer)),href:"#forecast-setting-list"})));
  }
  const result=decimalMoney(groups.reduce((sum,g)=>sum+moneyCents(g.amount),BigInt(0)));
  return {title:forecastMetrics[metric],date,groups,result};
}
