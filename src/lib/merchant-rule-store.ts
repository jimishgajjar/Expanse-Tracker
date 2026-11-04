import {and, desc, eq, sql} from "drizzle-orm";
import {z} from "zod";
import type {AppDb} from "./db";
import {merchantRuleVersions, tags, transactions} from "./db/schema";
import {normalizeMerchant} from "./merchant-rule-model";

const label=z.string().trim().min(2).max(80).refine(s=>normalizeMerchant(s).length>=2,"Use at least two letters or numbers.");
const ref=z.string().min(1).max(128);
export const scopeSchema=z.object({accountId:ref,kind:z.enum(["income","expense"])});
export const ruleInput=scopeSchema.extend({
  id:z.uuid(),base:z.number().int().min(0).max(1000000),
  definition:z.object({name:label,aliases:z.array(label).max(12),enabled:z.boolean(),
    priority:z.number().int().min(0).max(100),categoryId:ref.nullable(),tagIds:z.array(ref).max(12)})
    .refine(d=>d.categoryId!==null||d.tagIds.length>0,"Choose a category or tag."),
});
type Scope=z.infer<typeof scopeSchema>;
export async function readRuleBook(db:AppDb,workspace:string,{accountId,kind}:Scope){
  const [versions,notes,availableTags]=await Promise.all([
    db.select().from(merchantRuleVersions).where(and(eq(merchantRuleVersions.workspaceId,workspace),
      eq(merchantRuleVersions.accountId,accountId),eq(merchantRuleVersions.kind,kind))).orderBy(desc(merchantRuleVersions.version)),
    db.select({note:transactions.note}).from(transactions).where(and(eq(transactions.workspaceId,workspace),
      eq(transactions.accountId,accountId),eq(transactions.type,kind),sql`trim(${transactions.note})<>''`))
      .orderBy(desc(transactions.date),desc(transactions.id)).limit(100),
    db.select({id:tags.id,name:tags.name,color:tags.color}).from(tags).where(eq(tags.workspaceId,workspace)).orderBy(tags.name),
  ]);
  return {history:versions.map(v=>({...v.definition,id:v.id,version:v.version})),notes:notes.map(n=>n.note),tags:availableTags};
}
export type RuleBook=Awaited<ReturnType<typeof readRuleBook>>;

export async function appendRule(db:AppDb,workspace:string,actor:string,input:unknown){
  const {accountId,kind,id,base,definition:d}=ruleInput.parse(input);
  const rows=await db.execute(sql`INSERT INTO merchant_rule_versions(workspace_id,account_id,kind,id,version,definition,actor_id)
    SELECT ${workspace},${accountId},${kind}::tx_kind,${id},${base+1},${JSON.stringify(d)}::jsonb,${actor}
    WHERE EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id=${workspace} AND user_id=${actor} AND role IN ('owner','member'))
    AND EXISTS(SELECT 1 FROM accounts WHERE workspace_id=${workspace} AND id=${accountId} AND NOT archived)
    AND (${!d.enabled} OR (
      (${d.categoryId}::text IS NULL OR EXISTS(SELECT 1 FROM categories WHERE workspace_id=${workspace} AND kind=${kind} AND id=${d.categoryId}))
      AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(${JSON.stringify(d.tagIds)}::jsonb) x(id)
        WHERE NOT EXISTS(SELECT 1 FROM tags t WHERE t.workspace_id=${workspace} AND t.id=x.id))))
    AND ${base}=(SELECT coalesce(max(version),0) FROM merchant_rule_versions
      WHERE workspace_id=${workspace} AND account_id=${accountId} AND kind=${kind} AND id=${id})
    ON CONFLICT DO NOTHING RETURNING version`);
  return rows.rows.length===1;
}
