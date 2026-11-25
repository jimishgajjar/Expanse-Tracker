"use server";

import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { getActiveRole, getActiveWorkspaceId } from "./workspace";
import { canEditSharedLedger } from "./household-access";

export type QuickEntry = {
  type: "income" | "expense";
  note: string;
  accountId: string;
  categoryId: string | null;
  /** The amount used most recently for this entry. */
  amount: number;
  uses: number;
};

/**
 * The entries this household logs again and again (same description, account and
 * category at least twice in the last 120 days), most used first. Read-only: picking
 * one only fills the form, and the person still reviews and saves it.
 */
export async function quickEntries(): Promise<QuickEntry[]> {
  const workspace = await getActiveWorkspaceId();
  if (!workspace || !canEditSharedLedger(await getActiveRole())) return [];
  const db = await getDb();
  const result = await db.execute(sql`
    SELECT type::text AS type, account_id AS "accountId", category_id AS "categoryId", count(*)::int AS uses,
      (array_agg(note ORDER BY date DESC, created_at DESC))[1] AS note,
      (array_agg(amount ORDER BY date DESC, created_at DESC))[1]::float8 AS amount
    FROM transactions
    WHERE workspace_id = ${workspace} AND date >= current_date - 120 AND account_id IS NOT NULL AND trim(note) <> ''
    GROUP BY type, lower(trim(note)), account_id, category_id
    HAVING count(*) >= 2
    ORDER BY count(*) DESC, max(date) DESC
    LIMIT 6`);
  return (result.rows as QuickEntry[]).map((r) => ({ ...r, amount: Number(r.amount), uses: Number(r.uses) }));
}
