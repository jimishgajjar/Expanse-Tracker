"use server";
import {getDb} from "./db";
import {getActiveWorkspace} from "./workspace";
import {getCurrentUser} from "./session";
import {merchantRulesEnabled} from "./merchant-rule-feature";
import {appendRule,readRuleBook,scopeSchema} from "./merchant-rule-store";

async function access(){
  if(!merchantRulesEnabled()) throw Error();
  const workspace=await getActiveWorkspace();
  if(!workspace||!["owner","member"].includes(workspace.role)) throw Error();
  return workspace.id;
}
export async function loadMerchantRules(input:unknown){
  const workspace=await access();
  return readRuleBook(await getDb(),workspace,scopeSchema.parse(input));
}
export async function saveMerchantRule(input:unknown){
  const workspace=await access(),user=await getCurrentUser();
  if(!user) return false;
  return appendRule(await getDb(),workspace,user.id,input);
}
