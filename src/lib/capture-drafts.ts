import {sql} from "drizzle-orm";
import {z} from "zod";
import type {AppDb} from "./db";
import {creationReceiptId} from "./transaction-create";
type Scope={workspace:string;actor:string};
const ref=z.string().max(128);
export const draftPayload=z.object({
  form:z.object({type:z.enum(["income","expense"]),amount:z.string().max(32),date:z.string().max(10),
    note:z.string().max(200),accountId:ref,categoryId:ref,fromAccountId:ref,toAccountId:ref}),
  tags:z.array(z.object({id:ref,name:z.string().max(80),color:z.string().regex(/^#[0-9a-f]{6}$/i)})).max(100),
  portions:z.array(z.object({categoryId:ref,amount:z.string().max(32)})).max(20),
});
export type CaptureDraft={id:string;version:number;payload:z.infer<typeof draftPayload>};
const member=(s:Scope)=>sql`EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id=${s.workspace} AND user_id=${s.actor} AND role IN ('owner','member'))`;

export async function listDrafts(db:AppDb,s:Scope){
  const r=await db.execute(sql`SELECT id,version,payload FROM capture_drafts WHERE workspace_id=${s.workspace} AND user_id=${s.actor}
    AND ${member(s)} ORDER BY updated_at DESC,id`);
  return r.rows as CaptureDraft[];
}
export async function storeDraft(db:AppDb,s:Scope,input:unknown){
  const {id,version,payload}=z.object({id:z.uuid(),version:z.number().int().nonnegative(),payload:draftPayload}).parse(input);
  const data=JSON.stringify(payload);
  const r=await db.execute(version===0?sql`INSERT INTO capture_drafts(workspace_id,user_id,id,version,payload)
    SELECT ${s.workspace},${s.actor},${id},1,${data}::jsonb WHERE ${member(s)} AND NOT EXISTS
      (SELECT 1 FROM transaction_history WHERE id=${creationReceiptId(s.workspace,s.actor,id)})
      AND (SELECT count(*) FROM capture_drafts WHERE workspace_id=${s.workspace} AND user_id=${s.actor})<20
    ON CONFLICT DO NOTHING RETURNING version`:sql`UPDATE capture_drafts SET payload=${data}::jsonb,version=version+1,updated_at=now()
    WHERE workspace_id=${s.workspace} AND user_id=${s.actor} AND id=${id} AND version=${version} AND ${member(s)} RETURNING version`);
  return r.rows.length?Number(r.rows[0].version):null;
}
export async function discardDraft(db:AppDb,s:Scope,id:string,version:number){
  const r=await db.execute(sql`DELETE FROM capture_drafts WHERE workspace_id=${s.workspace} AND user_id=${s.actor}
    AND id=${id} AND version=${version} AND ${member(s)} RETURNING id`);
  return !!r.rows.length;
}
