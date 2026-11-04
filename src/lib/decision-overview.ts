import type {HouseholdDb} from "./household-db";
import {forecastBalances} from "./balance-forecast";
import {goalProgressSelect} from "./goal-progress";
import {authorizePlanning,readPeriods,type PlanningScope} from "./monthly-planning";
import {moneyCents} from "./statement-review";

// Overview always looks forward from today, independently of its historical activity filter.
export async function decisionOverview(db:HouseholdDb,scope:PlanningScope,now=new Date()){
  const forecast=await forecastBalances(db,scope,{scenario:"base",account:null,horizon:"30"},now);
  const month=forecast.start.slice(0,7);
  const planning=await db.transaction(async tx=>{
    await authorizePlanning(tx,scope,false);
    const periods=await readPeriods(tx,scope.workspace,month,forecast.start);
    const goals=(await tx.query<{id:string;name:string;target:string;confirmed:string;opening:string;reviewed:boolean}>(`
      SELECT id,name,target_amount::text AS target,confirmed,opening,reviewed
      FROM (${goalProgressSelect} WHERE g.workspace_id=$1) goal ORDER BY name,id`,[scope.workspace])).rows;
    return {periods:periods.map(({category,remaining})=>({category,remaining})),goals};
  });
  const projection=forecast.projection;
  // Keep bills and dated entries separate from estimated everyday spending in the list.
  const upcoming=(projection?.days??[]).flatMap(day=>day.events.filter(e=>e.source!=="Spending estimate")
    .map(e=>({date:day.date,key:e.key,label:e.label,source:e.source,detail:e.detail,change:e.change,cashChange:e.cashChange})));
  return {...planning,month,start:forecast.start,end:forecast.end,calculatedAt:forecast.calculatedAt,
    closing:projection?.closing??null,lowDate:projection?.cashLowDate??null,lowestCash:projection?.lowestCash??null,
    cashAccounts:forecast.assumptions.length,missingAssumptions:forecast.assumptions.filter(a=>!a.configured).map(a=>a.name),spendable:projection?.spendable??null,
    coverage:{accounts:forecast.coverage.accounts,bills:forecast.coverage.bills.map(({account,accountName,label,expected})=>({account,accountName,label,expected}))},
    warnings:forecast.warnings,upcoming:upcoming.slice(0,3),upcomingCount:upcoming.length,
    unreviewed:planning.goals.filter(g=>!g.reviewed&&moneyCents(g.opening)>BigInt(0)).length};
}
