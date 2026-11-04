"use server";

import {headers} from "next/headers";
import {revalidatePath} from "next/cache";
import {z} from "zod";
import {getActiveWorkspace} from "@/lib/workspace";
import {sandboxInboxEnabled} from "@/lib/plaid-sandbox/config";
import {localInbox,localReviews,reviewOptions} from "@/lib/plaid-sandbox/local";
import {observationVersion} from "@/lib/plaid-sandbox/inbox";
import {SandboxError} from "@/lib/plaid-sandbox/provider";

const id=z.uuid();
const key=z.string().min(1).max(512);
const source={id,record:key,version:z.string().regex(/^[a-f0-9]{64}$/)};
const booking={account:key,currency:z.string().length(3),settled:z.string().max(16).optional()};
const input=z.discriminatedUnion("op",[
  z.object({op:z.literal("begin")}),z.object({op:z.literal("repair"),id}),z.object({op:z.literal("refresh")}),
  z.object({op:z.literal("cancel"),id}),z.object({op:z.literal("exchange"),id,token:z.string().startsWith("public-sandbox-").max(512)}),
  z.object({op:z.literal("accounts"),id}),z.object({op:z.literal("select"),id,account:z.string().min(1).max(256)}),
  z.object({op:z.literal("sync"),id}),z.object({op:z.literal("disconnect"),id}),
  z.object({op:z.literal("clearUnconfirmed"),id,checked:z.literal(true)}),
  z.object({op:z.literal("preview"),...source,...booking}),
  z.object({op:z.literal("decide"),...source,decision:z.discriminatedUnion("kind",[
    z.object({kind:z.literal("ignore")}),z.object({kind:z.literal("match"),...booking,target:key}),
    z.object({kind:z.literal("import"),...booking,category:key.nullable(),acknowledgeMatches:z.boolean()}),
  ])}),
]);
export type Command=z.infer<typeof input>;
export async function bankCommand(workspace:string,raw:unknown){
  try{
    if(!sandboxInboxEnabled())throw Error();
    const h=await headers(),host=h.get("host");
    if(!["localhost:3122","127.0.0.1:3122"].includes(host??"")||h.get("origin")!=="http://"+host)throw Error();
    const owner=await getActiveWorkspace();
    if(!owner||owner.role!=="owner"||owner.id!==workspace)throw Error();
    const svc=localInbox(),cmd=input.parse(raw);
    if(cmd.op==="begin")return {ok:true as const,link:await svc.begin(owner.id)};
    if(cmd.op==="repair")return {ok:true as const,link:await svc.repair(owner.id,cmd.id)};
    if(cmd.op==="preview"){
      const preview=await svc.withObservation(owner.id,cmd.id,cmd.record,async row=>{
        if(observationVersion(row)!==cmd.version)throw new SandboxError("REVIEW_CHANGED");
        return (await localReviews()).preview(owner.id,row,cmd);
      });
      return {ok:true as const,preview};
    }
    switch(cmd.op){
      case "exchange":await svc.exchange(owner.id,cmd.id,cmd.token);break;
      case "cancel":await svc.cancel(owner.id,cmd.id);break;
      case "accounts":await svc.accounts(owner.id,cmd.id);break;
      case "select":await svc.select(owner.id,cmd.id,cmd.account);break;
      case "sync":await svc.sync(owner.id,cmd.id);break;
      case "disconnect":await svc.disconnect(owner.id,cmd.id);break;
      case "clearUnconfirmed":await svc.clearUnconfirmed(owner.id,cmd.id);break;
      case "decide":{
        const decision=cmd.decision;
        await svc.withObservation(owner.id,cmd.id,cmd.record,async row=>
          (await localReviews()).decide(owner.id,owner.ownerId,row,cmd.version,decision));
        if(decision.kind==="import"){
          revalidatePath("/");
          revalidatePath("/accounts/"+encodeURIComponent(decision.account));
        }
        break;
      }
    }
    const view=await svc.view(owner.id);
    return {ok:true as const,view,options:view?.phase==="active"?await reviewOptions(owner.id,view):null};
  }catch(e){
    const messages:Record<string,string>={PRODUCT_NOT_READY:"The test bank is preparing transactions. Try Sync again shortly.",
      ITEM_LOGIN_REQUIRED:"The test bank needs a new login. Choose Repair sign-in, then sync again.",
      STALE_CONNECTION:"This connection changed in another tab. Refresh the inbox before trying again.",
      REVIEW_CHANGED:"The bank entry or tracker details changed. Refresh and review again.",
      ALREADY_REVIEWED:"This entry already has a decision. Refresh saved state to see it.",
      UNBOOKABLE:"Only posted entries with a known currency and a nonzero amount can be booked.",
      SETTLED_AMOUNT_REQUIRED:"Enter a positive settled amount with up to two decimal places.",
      OPENING_CUTOFF:"This entry is covered by your opening statement. Match it to an existing entry or ignore it.",
      MATCH_AVAILABLE:"A possible match is available. Preview the entry again before importing."};
    return {ok:false as const,error:(e instanceof SandboxError&&messages[e.message])||"The request could not be confirmed. Refresh the inbox to see its saved state."};
  }
}
