"use server";
import { ZodError } from "zod";
import { getSession } from "./session";
import { getPlanningDb, type HouseholdDb } from "./household-db";
import { PlanningError, type PlanningScope } from "./monthly-planning";
import { checkAffordability, compareForecastBaseline, listForecastBaselines, saveForecastBaseline } from "./affordability-store";
async function run<T>(workspace:string,work:(db:HouseholdDb,s:PlanningScope)=>Promise<T>){
  try {
    const session=await getSession();
    if(!session||session.workspaceId!==workspace)throw new PlanningError("Reopen the current tracker before continuing.");
    const db=await getPlanningDb();
    if(!db)throw new PlanningError("This purchase check is unavailable on this server.");
    return {ok:true as const,value:await work(db,{workspace,actor:session.user.id})};
  }catch(error){return {ok:false as const,error:error instanceof PlanningError?error.message:error instanceof ZodError?"Check the account, date and amount. Use a positive amount with up to two decimals.":"Couldn't confirm this request. Refresh and try again."};}
}
export async function previewPurchase(workspace:string,input:unknown){return run(workspace,(db,s)=>checkAffordability(db,s,input));}
export async function keepForecastPlan(workspace:string,input:unknown){return run(workspace,(db,s)=>saveForecastBaseline(db,s,input));}
export async function savedForecastPlans(workspace:string,account:string){return run(workspace,(db,s)=>listForecastBaselines(db,s,account));}
export async function reviewForecastPlan(workspace:string,account:string,id:string){return run(workspace,(db,s)=>compareForecastBaseline(db,s,account,id));}
