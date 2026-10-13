import { sql } from "drizzle-orm";
import type { AppDb } from "./db";

/** Row lock + mutation + tag changes + history are a single atomic SQL statement.
 * No backfill: previous edits cannot be reconstructed honestly. */
export async function editWithHistory(db: AppDb, workspace: string, id: string, actor: {id:string;name:string}, patch: Record<string,unknown>, tagIds?: string[]) {
  const result = await db.execute(sql`
    WITH owned AS MATERIALIZED (
      SELECT t.*, COALESCE((SELECT jsonb_agg(tt.tag_id ORDER BY tt.tag_id) FROM transaction_tags tt WHERE tt.transaction_id=t.id),'[]'::jsonb) AS tag_ids
      FROM transactions t WHERE t.workspace_id=${workspace} AND t.id=${id} FOR UPDATE OF t
    ), updated AS (
      UPDATE transactions t SET (type,amount,date,note,account_id,category_id) =
        (SELECT p.type,p.amount,p.date,p.note,p.account_id,p.category_id FROM jsonb_populate_record(NULL::transactions,to_jsonb(t)||${JSON.stringify(patch)}::jsonb) p)
      FROM owned WHERE t.id=owned.id AND t.workspace_id=${workspace} RETURNING t.*
    ), removed_tags AS (
      DELETE FROM transaction_tags tt USING updated WHERE tt.transaction_id=updated.id
        AND ${tagIds !== undefined} AND tt.tag_id NOT IN (SELECT jsonb_array_elements_text(${JSON.stringify(tagIds ?? [])}::jsonb)) RETURNING tt.tag_id
    ), added_tags AS (
      INSERT INTO transaction_tags(transaction_id,tag_id)
      SELECT updated.id,tag.id FROM updated CROSS JOIN jsonb_array_elements_text(${JSON.stringify(tagIds ?? [])}::jsonb) tag(id)
      WHERE ${tagIds !== undefined} ON CONFLICT DO NOTHING RETURNING tag_id
    ), recorded AS (
      INSERT INTO transaction_history(id,workspace_id,transaction_id,actor_id,actor_name,"before","after")
      SELECT ${crypto.randomUUID()},${workspace},updated.id,${actor.id},${actor.name},to_jsonb(owned),
        to_jsonb(updated)||jsonb_build_object('tag_ids',CASE WHEN ${tagIds !== undefined} THEN ${JSON.stringify([...(tagIds ?? [])].sort())}::jsonb ELSE owned.tag_ids END)
      FROM owned JOIN updated ON owned.id=updated.id
      WHERE to_jsonb(owned) IS DISTINCT FROM (to_jsonb(updated)||jsonb_build_object('tag_ids',CASE WHEN ${tagIds !== undefined} THEN ${JSON.stringify([...(tagIds ?? [])].sort())}::jsonb ELSE owned.tag_ids END))
      RETURNING id
    ) SELECT EXISTS(SELECT 1 FROM updated) AS updated
  `);
  return result.rows[0]?.updated === true;
}
