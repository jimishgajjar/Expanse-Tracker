"use server";
import {getDb} from "./db";
import {getSession} from "./session";
import {getActiveWorkspace} from "./workspace";
import {merchantRulesEnabled} from "./merchant-rule-feature";
import {listDrafts,storeDraft,discardDraft} from "./capture-drafts";
async function scope(){
  if(!merchantRulesEnabled())throw Error("Unavailable");
  const [ws,s]=await Promise.all([getActiveWorkspace(),getSession()]);
  if(!ws||!s||!["owner","member"].includes(ws.role))throw Error("Unavailable");
  return {workspace:ws.id,actor:s.user.id};
}
export async function openDrafts(expected:{workspace:string;actor:string}){
  const s=await scope();
  if(expected.workspace!==s.workspace||expected.actor!==s.actor)throw Error("Reopen your workspace.");
  return listDrafts(await getDb(),s);
}
export async function changeDraft(expected:{workspace:string;actor:string},input:{id:string;version:number;payload?:unknown}){
  const s=await scope();
  if(expected.workspace!==s.workspace||expected.actor!==s.actor)return null;
  const db=await getDb();
  return input.payload===undefined?(await discardDraft(db,s,input.id,input.version)?0:null):storeDraft(db,s,input);
}
