"use server";
import {getPlanningDb, type HouseholdDb} from "./household-db";
import {revalidatePath} from "next/cache";
import {getActiveWorkspace} from "./workspace";
import {getCurrentUser} from "./session";
import {merchantRulesEnabled} from "./merchant-rule-feature";
import {BulkError,applyBulk,bulkTools,previewBulk,undoBulk} from "./bulk-edits";

async function run<T>(workspace:string,work:(db:HouseholdDb,scope:{workspace:string;actor:string;name:string})=>Promise<T>,refresh=false){
  try{
    if(!merchantRulesEnabled())throw new BulkError("Bulk editing is unavailable on this server.");
    const [active,user]=await Promise.all([getActiveWorkspace(),getCurrentUser()]);
    if(!user||active?.id!==workspace||!["owner","member"].includes(active.role))throw new BulkError("Edit access is required.");
    const db=await getPlanningDb();
    if(!db)throw new BulkError("Tracker storage is unavailable.");
    const value=await work(db,{workspace,actor:user.id,name:user.name||user.email});
    if(refresh)revalidatePath("/","layout");
    return {ok:true as const,value};
  }catch(e){
    return {ok:false as const,error:e instanceof BulkError?e.message:"Couldn’t confirm this request. Reopen bulk edit to check recent batches."};
  }
}
export async function getBulkTools(ws:string){return run(ws,bulkTools);}
export async function previewSelection(ws:string,input:unknown){return run(ws,(db,s)=>previewBulk(db,s,input));}
export async function applySelection(ws:string,input:unknown){return run(ws,(db,s)=>applyBulk(db,s,input),true);}
export async function undoSelection(ws:string,batch:string){return run(ws,(db,s)=>undoBulk(db,s,batch),true);}
