import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { AppDb } from "./db";
import { analyseStatement, decimalMoney, moneyCents, compareSnapshots, statementInput, statementDate, type LedgerSnapshot, type StatementReview } from "./statement-review";
import { createHash, randomUUID } from "node:crypto";

export class StatementReviewError extends Error {}
type Actor = { id: string; name: string };

// Every read of a completed review compares the saved facts against the current
// ledger. This also detects old clients, cron jobs and direct edits that do not
// yet emit audit events. No trigger or write to historical financial rows.
function ledger(workspace: string, account: string | SQL, end: string | SQL) {
  return sql`SELECT jsonb_build_object('initialBalance',a.initial_balance::text,
    'currency',COALESCE((SELECT currency_code FROM app_settings WHERE workspace_id=${workspace}),'INR'),
    'entries',COALESCE((SELECT jsonb_agg(item ORDER BY item->>'date',item->>'id') FROM (
      SELECT jsonb_build_object('id','tx:'||t.id,'date',t.date,'kind',t.type,'amount',t.amount::text,
        'delta',(CASE WHEN t.type='income' THEN t.amount ELSE -t.amount END)::text,'note',t.note,'accountId',t.account_id) AS item
      FROM transactions t WHERE t.workspace_id=${workspace} AND t.account_id=a.id AND t.date<=${end}::date
      UNION ALL
      SELECT jsonb_build_object('id','transfer:'||t.id,'date',t.date,'kind','transfer','amount',t.amount::text,
        'delta',(CASE WHEN t.from_account_id=a.id AND t.to_account_id=a.id THEN 0 WHEN t.to_account_id=a.id THEN t.amount ELSE -t.amount END)::text,
        'note',t.note,'accountId',a.id,'fromAccountId',t.from_account_id,'toAccountId',t.to_account_id)
      FROM transfers t WHERE t.workspace_id=${workspace} AND (t.from_account_id=a.id OR t.to_account_id=a.id) AND t.date<=${end}::date
    ) entries),'[]'::jsonb)) AS snapshot
    FROM accounts a WHERE a.id=${account} AND a.workspace_id=${workspace}`;
}
const membership = (workspace: string, actor: string, write = false) => sql`EXISTS(
  SELECT 1 FROM workspace_members WHERE workspace_id=${workspace} AND user_id=${actor}
  ${write ? sql`AND role IN ('owner','member')` : sql``})`;

export async function startStatementReview(db: AppDb, workspace: string, actor: Actor, input: unknown) {
  const value = statementInput.parse(input);
  const closing = decimalMoney(moneyCents(value.closingBalance));
  const result = await db.execute(sql`
    WITH current_ledger AS (${ledger(workspace, value.accountId, value.end)}), created AS (
      INSERT INTO reconciliation_sessions(id,workspace_id,account_id,start_date,end_date,closing_balance,snapshot,actor_id,actor_name,events)
      SELECT ${value.id},${workspace},${value.accountId},${value.start}::date,${value.end}::date,${closing}::numeric,snapshot,
        ${actor.id},${actor.name},jsonb_build_array(jsonb_build_object('event','started','actorId',${actor.id}::text,'actorName',${actor.name}::text,'at',now()))
      FROM current_ledger WHERE ${membership(workspace,actor.id,true)}
      ON CONFLICT(id) DO NOTHING RETURNING id
    ) SELECT id FROM created`);
  if (!result.rows.length) {
    const previous = await db.execute(sql`SELECT id FROM reconciliation_sessions WHERE id=${value.id} AND workspace_id=${workspace}
      AND actor_id=${actor.id} AND account_id=${value.accountId} AND start_date=${value.start}::date AND end_date=${value.end}::date
      AND closing_balance=${closing}::numeric AND ${membership(workspace,actor.id,true)}`);
    if (!previous.rows.length) throw new StatementReviewError("Unable to start this review. Check your access, account and statement details.");
  }
  return value.id;
}

async function readReviews(db: AppDb, workspace: string, actorId: string, filter: SQL, detailLimit=50): Promise<StatementReview[]> {
  const stored = await db.execute(sql`SELECT s.*,s.start_date::text AS start,s.end_date::text AS end,s.closing_balance::text AS closing,
    current_ledger.snapshot AS current_snapshot
    FROM reconciliation_sessions s LEFT JOIN LATERAL (
      ${ledger(workspace, sql`s.account_id`, sql`s.end_date`)}
    ) current_ledger ON true WHERE s.workspace_id=${workspace} AND ${filter} AND ${membership(workspace,actorId)}
    ORDER BY s.created_at DESC,s.id DESC LIMIT 20`);
  return stored.rows.map(row => {
    const snapshot = row.snapshot as LedgerSnapshot;
    const {changes,entryChanges,omittedChanges} = compareSnapshots(snapshot, row.current_snapshot as LedgerSnapshot | null,detailLimit);
    const correction=(row.events as {event:string;reason?:string}[]).find(e=>e.event==="correction");
    if(correction)changes.push("A statement correction was recorded: "+correction.reason+". Start a fresh review.");
    return {
      id: String(row.id), accountId: String(row.account_id), start: String(row.start), end: String(row.end),
      closingBalance: String(row.closing), snapshot, decisions: row.decisions as StatementReview["decisions"],
      duplicatesReviewed: row.duplicates_reviewed === true, status: row.status as StatementReview["status"],
      effectiveStatus: changes.length ? "needs_review" : row.status as StatementReview["status"],
      version: Number(row.version), actorName: String(row.actor_name),
      createdAt: new Date(String(row.created_at)).toISOString(),
      completedAt: row.completed_at ? new Date(String(row.completed_at)).toISOString() : null, changes,entryChanges,omittedChanges,
    };
  });
}

export async function readStatementReview(db: AppDb, workspace: string, actorId: string, id: string) {
  const [review] = await readReviews(db,workspace,actorId,sql`s.id=${id}`);
  if (!review) throw new StatementReviewError("Review not found or access was removed.");
  return review;
}
export async function listStatementReviews(db: AppDb, workspace: string, actorId: string, account: string) {
  return (await readReviews(db,workspace,actorId,sql`s.account_id=${account}`,0)).map(review => ({
    id:review.id,accountId:review.accountId,start:review.start,end:review.end,closingBalance:review.closingBalance,
    duplicatesReviewed:review.duplicatesReviewed,status:review.status,effectiveStatus:review.effectiveStatus,
    version:review.version,actorName:review.actorName,createdAt:review.createdAt,completedAt:review.completedAt,changes:review.changes,
  }));
}

const saveInput = z.object({
  id: z.uuid(), version: z.number().int().min(1),
  decisions: z.record(z.string().max(150),z.enum(["cleared","outstanding"])).refine(value=>Object.keys(value).length<=5000,"Review at most 5,000 entries in one statement."),
  duplicatesReviewed: z.boolean(), complete: z.boolean(),
});
export async function saveStatementReview(db: AppDb, workspace: string, actor: Actor, input: unknown) {
  const value = saveInput.parse(input);
  const review = await readStatementReview(db,workspace,actor.id,value.id);
  if (review.status === "completed") throw new StatementReviewError("This review is already completed. Start a new review for corrections.");
  if (review.effectiveStatus === "needs_review") throw new StatementReviewError("The ledger changed. Start a new review using the current entries.");
  const analysis = analyseStatement(review.snapshot,review.start,review.end,review.closingBalance,value.decisions,value.duplicatesReviewed);
  const ids = new Set(analysis.entries.map(entry=>entry.id));
  if (Object.keys(value.decisions).some(id=>!ids.has(id))) throw new StatementReviewError("The review contains an entry outside its statement period.");
  if (value.complete && !analysis.canComplete) throw new StatementReviewError("Clear the exact difference, review every entry and acknowledge possible duplicates before completing.");
  const event = {event:value.complete?"completed":"reviewed",actorId:actor.id,actorName:actor.name,decisions:value.decisions,duplicatesReviewed:value.duplicatesReviewed};
  const updated = await db.execute(sql`WITH current_ledger AS (${ledger(workspace,review.accountId,review.end)})
    UPDATE reconciliation_sessions s SET decisions=${JSON.stringify(value.decisions)}::jsonb,
      duplicates_reviewed=${value.duplicatesReviewed},status=${value.complete?"completed":"draft"},version=s.version+1,
      completed_at=CASE WHEN ${value.complete} THEN now() ELSE NULL END,
      events=s.events||jsonb_build_array(${JSON.stringify(event)}::jsonb||jsonb_build_object('at',now(),'version',s.version+1))
    FROM current_ledger WHERE s.id=${value.id} AND s.workspace_id=${workspace} AND s.version=${value.version}
      AND s.status='draft' AND NOT s.events @> '[{"event":"correction"}]'::jsonb
      AND s.snapshot=current_ledger.snapshot AND ${membership(workspace,actor.id,true)} RETURNING s.id`);
  if (!updated.rows.length) throw new StatementReviewError("This review or ledger changed, or your editing access was removed. Reload before continuing.");
  return readStatementReview(db,workspace,actor.id,value.id);
}

const correctionInput=z.strictObject({
  id:z.uuid(),version:z.int().positive(),requestId:z.uuid(),type:z.enum(["income","expense"]),
  amount:z.string().trim().regex(/^\d{1,12}(\.\d{1,2})?$/,"Enter a positive amount with at most two decimal places.")
    .refine(v=>/^\d{1,12}(\.\d{1,2})?$/.test(v)&&moneyCents(v)>BigInt(0),"The amount must be greater than zero.").transform(v=>decimalMoney(moneyCents(v))),
  date:statementDate,description:z.string().trim().min(1).max(160),reason:z.string().trim().min(1).max(300),
  verified:z.literal(true),separatePurchase:z.boolean(),
});

// One deliberate correction per discrepant draft. The versioned claim, visible ledger
// entry and both audit records succeed or roll back together. No schema migration.
export async function recordStatementCorrection(db:AppDb,workspace:string,actor:Actor,input:unknown){
  const data=correctionInput.parse(input);
  const review=await readStatementReview(db,workspace,actor.id,data.id);
  const analysis=analyseStatement(review.snapshot,review.start,review.end,review.closingBalance,review.decisions,review.duplicatesReviewed);
  const duplicate=analysis.entries.some(e=>e.date===data.date&&e.kind===data.type&&moneyCents(e.amount)===moneyCents(data.amount));
  if(data.date<review.start||data.date>review.end)throw new StatementReviewError("The missing entry must be dated within this statement.");
  if(duplicate&&!data.separatePurchase)throw new StatementReviewError("Check the entry with the same date and amount before adding a separate purchase or payment.");
  const ready=analysis.unreviewed===0&&analysis.difference!=="0.00"&&(!analysis.duplicateIds.length||review.duplicatesReviewed);
  const digest=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
  const receipt="statement:"+digest([workspace,actor.id,data.id,data.requestId]);
  const requestHash=digest(data),transactionId=randomUUID();
  const note="Statement correction · "+data.description;
  const provenance={version:1,source:"statement_correction",reviewId:data.id,reason:data.reason,requestHash};
  const after={id:transactionId,workspace_id:workspace,account_id:review.accountId,category_id:null,tag_ids:[],
    date:data.date,type:data.type,amount:data.amount,note,created_by:actor.id,_creation:provenance};
  const event={event:"correction",transactionId,actorId:actor.id,actorName:actor.name,reason:data.reason};
  const result=await db.execute(sql`WITH authorized AS MATERIALIZED (
      SELECT 1 FROM workspace_members WHERE workspace_id=${workspace} AND user_id=${actor.id} AND role IN ('member','owner') FOR SHARE
    ), active_account AS MATERIALIZED (
      SELECT 1 FROM accounts WHERE workspace_id=${workspace} AND id=${review.accountId} AND NOT archived FOR SHARE
    ), current_ledger AS (${ledger(workspace,review.accountId,review.end)}), claim AS (
      UPDATE reconciliation_sessions s SET version=s.version+1,
        events=s.events||jsonb_build_array(${JSON.stringify(event)}::jsonb||jsonb_build_object('at',now(),'version',s.version+1))
      FROM current_ledger WHERE s.workspace_id=${workspace} AND s.id=${data.id}
        AND s.version=${data.version} AND s.version=${review.version} AND s.status='draft' AND ${ready}
        AND s.snapshot=current_ledger.snapshot AND NOT s.events @> '[{"event":"correction"}]'::jsonb
        AND EXISTS(SELECT 1 FROM authorized) AND EXISTS(SELECT 1 FROM active_account) RETURNING s.id
    ), history AS (
      INSERT INTO transaction_history(id,workspace_id,transaction_id,actor_id,actor_name,"before","after")
      SELECT ${receipt},${workspace},${transactionId},${actor.id},${actor.name},'{}'::jsonb,${JSON.stringify(after)}::jsonb FROM claim RETURNING transaction_id
    ) INSERT INTO transactions(id,workspace_id,account_id,type,amount,date,note,created_by)
      SELECT transaction_id,${workspace},${review.accountId},${data.type}::tx_kind,${data.amount}::numeric,${data.date}::date,${note},${actor.id}
      FROM history RETURNING id`);
  if(!result.rows.length){
    const replay=await db.execute(sql`SELECT h."after"->'_creation'->>'requestHash' AS hash,
      EXISTS(SELECT 1 FROM transactions t WHERE t.id=h.transaction_id AND t.workspace_id=h.workspace_id) AS present
      FROM transaction_history h WHERE h.id=${receipt} AND h.workspace_id=${workspace} AND ${membership(workspace,actor.id,true)}`);
    if(replay.rows[0]?.hash!==requestHash)throw new StatementReviewError("Correction not recorded. Reload the saved review and check its status, your editing access, and the saved decisions.");
    if(!replay.rows[0].present)throw new StatementReviewError("This correction was already recorded and later removed. It was not added again.");
  }
  return readStatementReview(db,workspace,actor.id,data.id);
}
