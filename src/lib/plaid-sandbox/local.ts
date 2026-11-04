import {PGlite} from "@electric-sql/pglite";
import {resolve} from "node:path";
import {SandboxProvider} from "./provider";
import {Inbox} from "./inbox";
import {sandboxInboxEnabled} from "./config";
import {getDb} from "../db";
import {SandboxReviews} from "./reviews";
import type {InboxView} from "./inbox";

const state=globalThis as unknown as {sandboxBankInbox?:Inbox};
const reviewState=globalThis as unknown as {sandboxBankReviews?:SandboxReviews};
export async function localReviews(){
  if(!sandboxInboxEnabled())throw Error("Sandbox reviews unavailable.");
  const client=(await getDb() as unknown as {$client:PGlite}).$client;
  if(!(client instanceof PGlite))throw Error("Local preview ledger required.");
  return reviewState.sandboxBankReviews??=new SandboxReviews(client);
}
export async function reviewOptions(workspace:string,view:InboxView){
  if(view?.phase!=="active"||!view.selected)return null;
  return (await localReviews()).options(workspace,view.selected);
}
export function localInbox(){
  if(!sandboxInboxEnabled())throw Error("Sandbox inbox unavailable.");
  return state.sandboxBankInbox??=new Inbox(new PGlite(resolve(".pglite-bank-inbox")),new SandboxProvider({
    clientId:process.env.PLAID_SANDBOX_CLIENT_ID!,secret:process.env.PLAID_SANDBOX_SECRET!,
  }),Buffer.from(process.env.BANK_LOCAL_KEY!,"base64"));
}
