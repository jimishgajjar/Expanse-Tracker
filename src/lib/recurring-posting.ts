import { sql } from "drizzle-orm";
import type { AppDb } from "./db";
import type { recurring, transactions } from "./db/schema";

/** One SQL statement: advance a still-current rule and insert its occurrences.
 * A racing worker claims zero rows; a failed insert rolls back the advance.
 * Uses existing columns, so deploying requires no schema change or backfill.
 */
export async function postRecurringOccurrences(
  db: AppDb,
  rule: typeof recurring.$inferSelect,
  nextDate: string,
  occurrenceCount: number,
  entries: (typeof transactions.$inferInsert)[],
): Promise<boolean> {
  const payload = entries.map((entry) => ({
    ...entry,
    id: crypto.randomUUID(),
  }));
  const result = await db.execute(sql`
    WITH claimed AS (
      UPDATE recurring SET next_date = ${nextDate}::date, occurrence_count = ${occurrenceCount}
      WHERE id = ${rule.id} AND workspace_id = ${rule.workspaceId}
        AND next_date = ${rule.nextDate}::date AND occurrence_count = ${rule.occurrenceCount}
        AND amount = ${rule.amount}::numeric AND frequency = ${rule.frequency}
        AND auto_post = ${rule.autoPost}
      RETURNING id
    ), posted AS (
      INSERT INTO transactions (id, workspace_id, type, amount, date, note, account_id, category_id)
      SELECT entry.id, ${rule.workspaceId}, entry.type::tx_kind, entry.amount::numeric,
        entry.date::date, entry.note, entry."accountId", entry."categoryId"
      FROM jsonb_to_recordset(${JSON.stringify(payload)}::jsonb)
        AS entry(id text, type text, amount text, date text, note text, "accountId" text, "categoryId" text)
      CROSS JOIN claimed
      RETURNING id
    )
    SELECT EXISTS(SELECT 1 FROM claimed) AS claimed
  `);
  return result.rows[0]?.claimed === true;
}
