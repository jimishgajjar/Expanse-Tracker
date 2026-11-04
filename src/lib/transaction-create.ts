import { createHash, randomUUID } from "node:crypto";
import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import {allocationSchema,balanced} from "./purchase-allocation";

// Match numeric(14,2) without silently rounding a user's input.
const amount = z.union([z.string(), z.number()]).transform(String)
  .transform((value) => value.trim())
  .refine((value) => /^\d{1,12}(\.\d{1,2})?$/.test(value) && Number(value) > 0,
    "Enter a positive amount with no more than two decimal places.")
  .transform((value) => {
    const [whole, fraction = ""] = value.split(".");
    return `${BigInt(whole)}.${fraction.padEnd(2, "0")}`;
  });

export const transactionCreateSchema = z.object({
  type: z.enum(["income", "expense"]),
  amount,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date")
    .refine((value) => {
      const date = new Date(`${value}T00:00:00Z`);
      return value.slice(0, 4) !== "0000" && !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
    }, "Pick a valid calendar date"),
  note: z.string().trim().max(200).default(""),
  accountId: z.string().min(1, "Pick an account").max(128),
  categoryId: z.string().min(1).max(128).nullable().optional().transform((id) => id ?? null),
  tagIds: z.array(z.string().min(1).max(128)).max(100).default([])
    .transform((ids) => [...new Set(ids)].sort()),
  // A request identity is not an authorization token. Old clients may omit it.
  requestId: z.string().min(16).max(128).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  allocations: allocationSchema.optional(),
}).refine(d=>!d.allocations||(d.type==="expense"&&d.categoryId===null&&balanced(d.amount,d.allocations)),
  "Split portions must equal the purchase total and replace the single expense category.");

export class TransactionCreateError extends Error {
  constructor(message: string, readonly reason: "invalid" | "different" | "deleted" = "invalid") { super(message); }
}
export const creationReceiptId=(workspace:string,actor:string,request:string)=>
  "create:"+createHash("sha256").update(JSON.stringify([workspace,actor,request])).digest("hex");

/** A creation history row doubles as a durable receipt, including after deletion.
 * One SQL statement commits receipt + transaction + tags, or none of them.
 * No schema change; existing backup/export already include transaction_history.
 */
export async function createWithHistory(
  db: { execute(query: SQL): PromiseLike<{ rows: Record<string, unknown>[] }> },
  workspace: string,
  actor: { id: string; name: string },
  input: unknown,
  draftVersion?:number,
) {
  const { requestId = randomUUID(), ...data } = transactionCreateSchema.parse(input);
  const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  const receiptId = creationReceiptId(workspace,actor.id,requestId);
  const requestHash = digest(data);
  const transactionId = randomUUID();
  const snapshot = {
    id: transactionId, workspace_id: workspace, type: data.type, amount: data.amount,
    date: data.date, note: data.note, account_id: data.accountId,
    category_id: data.categoryId, created_by: actor.id, tag_ids: data.tagIds,
    ...(data.allocations?{allocations:data.allocations}:{}),
    _creation: { version: 1, requestHash, source: "manual" },
  };
  const result = await db.execute(sql`
    WITH authorized AS MATERIALIZED (
      SELECT user_id FROM workspace_members
      WHERE workspace_id=${workspace} AND user_id=${actor.id} AND role IN ('owner','member')
      FOR SHARE
    ), owned_account AS MATERIALIZED (
      SELECT id FROM accounts WHERE id=${data.accountId} AND workspace_id=${workspace} AND NOT archived FOR SHARE
    ), owned_category AS MATERIALIZED (
      SELECT id FROM categories WHERE id=${data.categoryId} AND workspace_id=${workspace} AND kind=${data.type} FOR SHARE
    ), owned_tags AS MATERIALIZED (
      SELECT id FROM tags WHERE workspace_id=${workspace}
        AND id IN (SELECT jsonb_array_elements_text(${JSON.stringify(data.tagIds)}::jsonb))
      ORDER BY id FOR SHARE
    ), receipt AS (
      INSERT INTO transaction_history(id,workspace_id,transaction_id,actor_id,actor_name,"before","after")
      SELECT ${receiptId},${workspace},${transactionId},${actor.id},${actor.name},'{}'::jsonb,${JSON.stringify(snapshot)}::jsonb
      WHERE EXISTS(SELECT 1 FROM authorized) AND EXISTS(SELECT 1 FROM owned_account)
        ${draftVersion===undefined?sql``:sql`AND EXISTS(SELECT 1 FROM capture_drafts WHERE workspace_id=${workspace} AND user_id=${actor.id}
          AND id=${requestId} AND version=${draftVersion} FOR UPDATE)`}
        AND (${data.categoryId === null} OR EXISTS(SELECT 1 FROM owned_category))
        AND (SELECT count(*) FROM owned_tags)=${data.tagIds.length}
        ${data.allocations?sql`AND (SELECT count(*) FROM (SELECT id FROM categories WHERE workspace_id=${workspace} AND kind='expense'
          AND id IN (SELECT jsonb_array_elements_text(${JSON.stringify(data.allocations.map(a=>a.categoryId))}::jsonb)) FOR SHARE) valid)=${data.allocations.length}`:sql``}
      ON CONFLICT(id) DO NOTHING RETURNING transaction_id
    ), inserted AS (
      INSERT INTO transactions(id,workspace_id,type,amount,date,note,account_id,category_id,created_by)
      SELECT transaction_id,${workspace},${data.type}::tx_kind,${data.amount}::numeric,${data.date}::date,
        ${data.note},${data.accountId},${data.categoryId},${actor.id} FROM receipt RETURNING id
    ), linked AS (
      INSERT INTO transaction_tags(transaction_id,tag_id)
      SELECT inserted.id,owned_tags.id FROM inserted CROSS JOIN owned_tags RETURNING tag_id
    ) ${data.allocations?sql`, allocated AS (INSERT INTO purchase_allocations(transaction_id,category_id,amount)
      SELECT inserted.id,line->>'categoryId',(line->>'amount')::numeric FROM inserted CROSS JOIN jsonb_array_elements(${JSON.stringify(data.allocations)}::jsonb) line)`:sql``}
    ${draftVersion===undefined?sql``:sql`, consumed AS (DELETE FROM capture_drafts WHERE workspace_id=${workspace} AND user_id=${actor.id}
      AND id=${requestId} AND version=${draftVersion} AND EXISTS(SELECT 1 FROM inserted))`}
    SELECT id FROM inserted
  `);
  if (result.rows[0]?.id) return { id: String(result.rows[0].id), replayed: false };

  // A concurrent ON CONFLICT can see a committed conflict that the statement's
  // original snapshot cannot. Read its receipt in a fresh, authorized statement.
  const replay = await db.execute(sql`
    SELECT h.transaction_id,h."after"->'_creation'->>'requestHash' AS request_hash,
      EXISTS(SELECT 1 FROM transactions t WHERE t.id=h.transaction_id AND t.workspace_id=${workspace}) AS present
    FROM transaction_history h JOIN workspace_members m ON m.workspace_id=h.workspace_id
    WHERE h.id=${receiptId} AND h.workspace_id=${workspace} AND h.actor_id=${actor.id}
      AND m.user_id=${actor.id} AND m.role IN ('owner','member')
  `);
  const previous = replay.rows[0];
  if (!previous) throw new TransactionCreateError(draftVersion===undefined?
    "Unable to save. Check your access and choose an active account, matching category, and tags from this workspace.":
    "Couldn’t post the draft. Reopen Saved drafts to check its version and confirm its account, category and tags.");
  if (previous.request_hash !== requestHash)
    throw new TransactionCreateError("This request was already saved with different details. Check Activity and edit that transaction before trying again.", "different");
  if (!previous.present)
    throw new TransactionCreateError("This request was already saved and later deleted. It has not been created again.", "deleted");
  return { id: String(previous.transaction_id), replayed: true };
}
