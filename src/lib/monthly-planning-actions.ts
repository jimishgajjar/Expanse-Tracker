"use server";
import {getPlanningDb, type HouseholdDb} from "./household-db";
import {getActiveWorkspace} from "./workspace";
import {getCurrentUser} from "./session";
import {merchantRulesEnabled} from "./merchant-rule-feature";
import {planningMonth,PlanningError,reserveCash,moveBudget,reviewGoalOpening,savePlan,savePayday,saveAnnualFund,removeSchedule} from "./monthly-planning";
import {revalidatePath} from "next/cache";
import {saveForecastScenario} from "./forecast-scenario";
import {forecastBalances} from "./balance-forecast";
import {decisionOverview} from "./decision-overview";
import {refundReview,linkRefund,unlinkRefund} from "./refund-links";
import {ZodError} from "zod";

async function run<T>(ws:string,work:(db:HouseholdDb,s:{workspace:string;actor:string})=>Promise<T>){
  try{
    if(!merchantRulesEnabled())throw new PlanningError("This planner is unavailable on this server.");
    const [active,user]=await Promise.all([getActiveWorkspace(),getCurrentUser()]);
    if(!user||active?.id!==ws)throw new PlanningError("Reopen your workspace.");
    const client=await getPlanningDb();
    if(!client)throw new PlanningError("Tracker storage is unavailable.");
    return {ok:true as const,value:await work(client,{workspace:ws,actor:user.id})};
  }catch(e){return {ok:false as const,error:e instanceof PlanningError?e.message:e instanceof ZodError?"Check the dates and amounts. Use up to two decimal places.":"Couldn’t confirm the change. Reopen the panel to check the saved details."};}
}
export async function loadMonth(ws:string,month:string){return run(ws,(db,s)=>planningMonth(db,s,month));}
export async function setMonthlyPlan(ws:string,input:unknown){return run(ws,(db,s)=>savePlan(db,s,input));}
export async function allocateToGoal(ws:string,input:unknown){return run(ws,async(db,s)=>{await reserveCash(db,s,input);revalidatePath("/");});}
export async function setPayday(ws:string,input:unknown){return run(ws,(db,s)=>savePayday(db,s,input));}
export async function setAnnualFund(ws:string,input:unknown){return run(ws,(db,s)=>saveAnnualFund(db,s,input));}
export async function removePlanningSchedule(ws:string,input:unknown){return run(ws,(db,s)=>removeSchedule(db,s,input));}

export async function reviewRefund(ws:string,credit:string,search="",purchase=""){
  return run(ws,(db,s)=>refundReview(db,s,credit,search,purchase));
}
export async function saveRefund(ws:string,input:unknown){
  return run(ws,async(db,s)=>{await linkRefund(db,s,input);revalidatePath("/","layout");});
}
export async function removeRefund(ws:string,credit:string,link:string){
  return run(ws,async(db,s)=>{await unlinkRefund(db,s,credit,link);revalidatePath("/","layout");});
}

export async function moveMonthlyBudget(ws:string,input:unknown){return run(ws,(db,s)=>moveBudget(db,s,input));}

export async function saveGoalOpeningReview(ws:string,input:unknown){return run(ws,async(db,s)=>{await reviewGoalOpening(db,s,input);revalidatePath("/");});}

export async function loadBalanceForecast(ws:string,input:unknown){return run(ws,(db,s)=>forecastBalances(db,s,input));}
export async function loadDecisionOverview(ws:string){return run(ws,(db,s)=>decisionOverview(db,s));}

export async function setForecastScenario(ws:string,input:unknown){return run(ws,(db,s)=>saveForecastScenario(db,s,input));}
