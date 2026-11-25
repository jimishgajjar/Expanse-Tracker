import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { AppDb } from "./db";

export type Scope = { workspace: string; actor: string; name: string };
export type ConvertResult = { ok: true; transferId?: string } | { ok: false; error: string };

const writer = (s: Scope) => sql`writer AS MATERIALIZED (
  SELECT user_id FROM workspace_members WHERE workspace_id=${s.workspace} AND user_id=${s.actor} AND role IN ('owner','member') FOR SHARE)`;

/** Entries on another account that look like the other side of the same move. */
export async function transferCandidates(db: AppDb, s: Scope, id: string) {
  const res = await db.execute(sql`
    SELECT c.id, c.note, c.date::text AS date, c.account_id AS "accountId", c.amount::float8 AS amount, c.type::text AS type
    FROM transactions t JOIN transactions c ON c.workspace_id=t.workspace_id AND c.id<>t.id AND c.type<>t.type
      AND c.amount=t.amount AND c.account_id IS NOT NULL AND c.account_id IS DISTINCT FROM t.account_id
      AND c.date BETWEEN t.date - 7 AND t.date + 7
    WHERE t.id=${id} AND t.workspace_id=${s.workspace}
      AND EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id=${s.workspace} AND user_id=${s.actor})
    ORDER BY abs(c.date - t.date), c.id LIMIT 10`);
  return res.rows as { id: string; note: string; date: string; accountId: string; amount: number; type: "income" | "expense" }[];
}

/**
 * Replace an income or expense with a transfer between two of the household's own accounts.
 * The entry's own account keeps exactly the same balance. If `counterpart` (the matching
 * opposite entry on the other account) is given, it is removed too, so the other account's
 * balance is also unchanged; income and spending totals drop by the amount, which is the point.
 * One statement: it either all happens or nothing does. History records both removals.
 */
export async function convertToTransfer(db: AppDb, s: Scope, input: { id: string; otherAccountId: string; counterpartId: string | null }) {
  const transferId = randomUUID();
  const res = await db.execute(sql`
    WITH ${writer(s)},
    src AS MATERIALIZED (
      SELECT t.* FROM transactions t, writer WHERE t.id=${input.id} AND t.workspace_id=${s.workspace}
        AND t.account_id IS NOT NULL AND t.account_id<>${input.otherAccountId} FOR UPDATE OF t),
    other AS MATERIALIZED (
      SELECT a.id FROM accounts a WHERE a.id=${input.otherAccountId} AND a.workspace_id=${s.workspace} AND NOT a.archived FOR SHARE),
    pair AS MATERIALIZED (
      SELECT c.* FROM transactions c, src WHERE ${input.counterpartId}::text IS NOT NULL AND c.id=${input.counterpartId}
        AND c.workspace_id=${s.workspace} AND c.account_id=${input.otherAccountId} AND c.type<>src.type AND c.amount=src.amount FOR UPDATE OF c),
    ok AS (SELECT src.* FROM src, other WHERE ${input.counterpartId}::text IS NULL OR EXISTS (SELECT 1 FROM pair)),
    moved AS (
      INSERT INTO transfers(id, workspace_id, amount, date, note, from_account_id, to_account_id)
      SELECT ${transferId}, ${s.workspace}, ok.amount, ok.date, ok.note,
        CASE WHEN ok.type='expense' THEN ok.account_id ELSE ${input.otherAccountId} END,
        CASE WHEN ok.type='expense' THEN ${input.otherAccountId} ELSE ok.account_id END
      FROM ok RETURNING id),
    gone AS (
      DELETE FROM transactions t WHERE t.workspace_id=${s.workspace} AND EXISTS (SELECT 1 FROM moved)
        AND t.id IN (SELECT id FROM ok UNION ALL SELECT id FROM pair) RETURNING t.id),
    logged AS (
      INSERT INTO transaction_history(id, workspace_id, transaction_id, actor_id, actor_name, "before", "after")
      SELECT gen_random_uuid()::text, ${s.workspace}, x.id, ${s.actor}, ${s.name}, to_jsonb(x),
        jsonb_build_object('converted_to_transfer', ${transferId}::text)
      FROM (SELECT * FROM src UNION ALL SELECT * FROM pair) x WHERE EXISTS (SELECT 1 FROM moved) RETURNING 1)
    SELECT (SELECT count(*) FROM moved)::int AS moved, (SELECT count(*) FROM gone)::int AS gone`);
  const row = res.rows[0] as { moved: number; gone: number } | undefined;
  const expected = input.counterpartId ? 2 : 1;
  if (!row?.moved || row.gone !== expected) return { ok: false, error: "This entry changed or is no longer available. Refresh and try again." } satisfies ConvertResult;
  return { ok: true, transferId } satisfies ConvertResult;
}

/**
 * Remove an income or expense and fold its amount into its account's starting balance.
 * The account balance is unchanged; the amount stops counting as income or spending.
 * Meant for opening balances that were recorded as income.
 */
export async function moveToOpeningBalance(db: AppDb, s: Scope, id: string) {
  const res = await db.execute(sql`
    WITH ${writer(s)},
    src AS MATERIALIZED (
      SELECT t.* FROM transactions t, writer WHERE t.id=${id} AND t.workspace_id=${s.workspace} AND t.account_id IS NOT NULL FOR UPDATE OF t),
    acct AS (
      UPDATE accounts a SET initial_balance = a.initial_balance + CASE WHEN src.type='income' THEN src.amount ELSE -src.amount END
      FROM src WHERE a.id=src.account_id AND a.workspace_id=${s.workspace} RETURNING a.id),
    gone AS (
      DELETE FROM transactions t WHERE t.id IN (SELECT id FROM src) AND EXISTS (SELECT 1 FROM acct) RETURNING t.id),
    logged AS (
      INSERT INTO transaction_history(id, workspace_id, transaction_id, actor_id, actor_name, "before", "after")
      SELECT gen_random_uuid()::text, ${s.workspace}, src.id, ${s.actor}, ${s.name}, to_jsonb(src),
        jsonb_build_object('moved_to_opening_balance', src.account_id)
      FROM src WHERE EXISTS (SELECT 1 FROM acct) RETURNING 1)
    SELECT (SELECT count(*) FROM acct)::int AS updated, (SELECT count(*) FROM gone)::int AS gone`);
  const row = res.rows[0] as { updated: number; gone: number } | undefined;
  if (row?.updated !== 1 || row.gone !== 1) return { ok: false, error: "This entry changed or is no longer available. Refresh and try again." } satisfies ConvertResult;
  return { ok: true } satisfies ConvertResult;
}
