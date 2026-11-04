import { sql } from "drizzle-orm";
import type { AppDb } from "./db";
import type {Allocation} from "./purchase-allocation";
import {merchantRulesEnabled} from "./merchant-rule-feature";

/** Row lock + mutation + tag changes + history are a single atomic SQL statement.
 * No backfill: previous edits cannot be reconstructed honestly. */
export async function editWithHistory(db: AppDb, workspace: string, id: string, actor: {id:string;name:string}, patch: Record<string,unknown>, tagIds?: string[],
  split?:{lines:Allocation[]; previous:Allocation[]}, allocationSupport=merchantRulesEnabled(), expectedRevision?:string) {
  if(split&&!allocationSupport)return false;
  const next=JSON.stringify(split?.lines??[]);
  const after=sql`to_jsonb(updated)||jsonb_build_object('tag_ids',CASE WHEN ${tagIds !== undefined} THEN ${JSON.stringify([...(tagIds ?? [])].sort())}::jsonb ELSE owned.tag_ids END)
    ${allocationSupport?sql`||jsonb_build_object('allocations',${split?sql`${next}::jsonb`:sql`owned.allocations`})`:sql``}`;
  const result = await db.execute(sql`
    WITH writer AS MATERIALIZED (
      SELECT user_id FROM workspace_members WHERE workspace_id=${workspace} AND user_id=${actor.id}
        AND role IN ('owner','member') FOR SHARE
    ), owned AS MATERIALIZED (
      SELECT t.*, COALESCE((SELECT jsonb_agg(tt.tag_id ORDER BY tt.tag_id) FROM transaction_tags tt WHERE tt.transaction_id=t.id),'[]'::jsonb) AS tag_ids
      ${allocationSupport?sql`,coalesce((SELECT jsonb_agg(jsonb_build_object('categoryId',p.category_id,'amount',p.amount::text) ORDER BY p.category_id COLLATE "C") FROM purchase_allocations p WHERE p.transaction_id=t.id),'[]'::jsonb) AS allocations`:sql``}
      FROM transactions t CROSS JOIN writer WHERE t.workspace_id=${workspace} AND t.id=${id}
      ${expectedRevision===undefined?sql``:sql`AND t.xmin::text=${expectedRevision}`} FOR UPDATE OF t
    ), updated AS (
      UPDATE transactions t SET (type,amount,date,note,account_id,category_id) =
        (SELECT p.type,p.amount,p.date,p.note,p.account_id,p.category_id FROM jsonb_populate_record(NULL::transactions,to_jsonb(t)||${JSON.stringify(patch)}::jsonb) p)
      FROM owned WHERE t.id=owned.id AND t.workspace_id=${workspace}
      ${allocationSupport?(split?sql`AND owned.allocations=${JSON.stringify(split.previous)}::jsonb
        AND (SELECT count(*) FROM categories WHERE workspace_id=${workspace} AND kind='expense' AND id IN
          (SELECT line->>'categoryId' FROM jsonb_array_elements(${next}::jsonb) line))=${split.lines.length}
        AND (${split.lines.length} = 0 OR (${String(patch.type)}='expense' AND ${patch.category_id===null} AND
          ${String(patch.amount)}::numeric=(SELECT sum((line->>'amount')::numeric) FROM jsonb_array_elements(${next}::jsonb) line)))`
        :sql`AND (owned.allocations='[]'::jsonb OR (coalesce(${patch.amount??null}::numeric,t.amount)=t.amount
          AND coalesce(${patch.type??null}::text,t.type::text)=t.type::text AND ${patch.category_id==null}))`):sql``}
      RETURNING t.*
    ), removed_tags AS (
      DELETE FROM transaction_tags tt USING updated WHERE tt.transaction_id=updated.id
        AND ${tagIds !== undefined} AND tt.tag_id NOT IN (SELECT jsonb_array_elements_text(${JSON.stringify(tagIds ?? [])}::jsonb)) RETURNING tt.tag_id
    ), added_tags AS (
      INSERT INTO transaction_tags(transaction_id,tag_id)
      SELECT updated.id,tag.id FROM updated CROSS JOIN jsonb_array_elements_text(${JSON.stringify(tagIds ?? [])}::jsonb) tag(id)
      WHERE ${tagIds !== undefined} ON CONFLICT DO NOTHING RETURNING tag_id
    ) ${split?sql`, cleared_allocations AS (
      DELETE FROM purchase_allocations p USING updated WHERE p.transaction_id=updated.id AND NOT EXISTS
        (SELECT 1 FROM jsonb_array_elements(${next}::jsonb) line WHERE line->>'categoryId'=p.category_id)
    ), saved_allocations AS (
      INSERT INTO purchase_allocations(transaction_id,category_id,amount)
      SELECT updated.id,line->>'categoryId',(line->>'amount')::numeric FROM updated CROSS JOIN jsonb_array_elements(${next}::jsonb) line
      ON CONFLICT(transaction_id,category_id) DO UPDATE SET amount=excluded.amount
    )`:sql``}, recorded AS (
      INSERT INTO transaction_history(id,workspace_id,transaction_id,actor_id,actor_name,"before","after")
      SELECT ${crypto.randomUUID()},${workspace},updated.id,${actor.id},${actor.name},to_jsonb(owned),
        ${after}
      FROM owned JOIN updated ON owned.id=updated.id
      WHERE to_jsonb(owned) IS DISTINCT FROM (${after})
      RETURNING id
    ) SELECT EXISTS(SELECT 1 FROM updated) AS updated
  `);
  return result.rows[0]?.updated === true;
}
