import { createHash } from "node:crypto";
import { addDays, format, parseISO } from "date-fns";
import { z } from "zod";
import type { HouseholdDb, HouseholdTransaction } from "./household-db";
import { canEditSharedLedger, isPersonalLedger } from "./household-access";
import { goalProgressSelect } from "./goal-progress";
import { weeklyHouseholdCheckIn } from "./weekly-household";
import { decimalMoney, moneyCents } from "./statement-review";
import type { SplitData } from "./queries";
import { reviewItems, type ReviewDecisions, type WeeklyReviewData, type WeeklyReviewSource } from "./weekly-review-model";

type Scope = { workspace: string; actor: string };
type Progress = { version: number; decisions: ReviewDecisions };
type ReceiptItem = { key: string; revision: string; choice: "pending" | "reviewed" | "deferred" };
export class WeeklyReviewError extends Error {}
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const versionInput = z.object({ version: z.int().nonnegative() });
const choiceInput = versionInput.extend({
  key: z.string().min(1).max(180),
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  choice: z.enum(["reviewed", "deferred", "pending"]),
});
const finishInput = versionInput.extend({ id: z.uuid(), digest: z.string().regex(/^[a-f0-9]{64}$/) });

async function authorize(tx: HouseholdTransaction, scope: Scope, write: boolean) {
  if (isPersonalLedger(scope.workspace)) throw new WeeklyReviewError("Open your shared household to review together.");
  const { rows: [member] } = await tx.query<{ role: string }>(`SELECT role FROM workspace_members
    WHERE workspace_id=$1 AND user_id=$2 AND role IN ('owner','member','viewer') FOR SHARE`, [scope.workspace, scope.actor]);
  if (!member || (write && !canEditSharedLedger(member.role))) throw new WeeklyReviewError("Reopen your household and check your access.");
  return canEditSharedLedger(member.role);
}

async function installed(tx: HouseholdTransaction) {
  const { rows: [schema] } = await tx.query<{ ready: boolean }>(`SELECT
    to_regclass('public.weekly_review_progress') IS NOT NULL AND
    to_regclass('public.weekly_review_receipts') IS NOT NULL AS ready`);
  return schema.ready;
}

async function sources(tx: HouseholdTransaction, scope: Scope, now: Date) {
  const { rows: [clock] } = await tx.query<{ today: string; currency: string }>(`SELECT
    ($2::timestamptz AT TIME ZONE coalesce((SELECT timezone FROM household_setup WHERE workspace_id=$1),'UTC'))::date::text AS today,
    coalesce((SELECT currency_code FROM app_settings WHERE workspace_id=$1),'INR') AS currency`, [scope.workspace, now.toISOString()]);
  const through = format(addDays(parseISO(clock.today), 6), "yyyy-MM-dd");
  const result: WeeklyReviewSource[] = [];
  // Share recipients and personal ledgers never enter this query, including its counts or revision hashes.
  const bills = await tx.query<{ id: string; note: string; amount: string; currency: string; next: string; auto: boolean; facts: unknown }>(`
    SELECT r.id,r.note,r.amount::text,r.next_date::text AS next,r.auto_post AS auto,
      coalesce((SELECT d.currency FROM account_denominations d WHERE d.workspace_id=r.workspace_id AND d.account_id=r.account_id),$3) AS currency,
      jsonb_build_array(r.account_id,r.category_id,r.amount::text,r.next_date,r.end_date,r.frequency,
        r.max_occurrences,r.occurrence_count,r.auto_post,r.commitment_type,r.note) AS facts
    FROM recurring r WHERE r.workspace_id=$1 AND r.type='expense'
      AND (r.account_id IS NULL OR EXISTS(SELECT 1 FROM accounts a WHERE a.id=r.account_id AND a.workspace_id=$1 AND NOT a.archived))
      AND (r.end_date IS NULL OR (r.end_date >= $2 AND r.next_date <= r.end_date))
      AND (r.max_occurrences IS NULL OR r.occurrence_count < r.max_occurrences)
    ORDER BY r.next_date,r.id FOR SHARE OF r`, [scope.workspace, clock.today, clock.currency]);
  for (const bill of bills.rows) result.push({
    key: "bill:" + bill.id, revision: hash([bill.currency, bill.facts]), kind: "bill",
    title: bill.note || "Recurring payment", amount: bill.amount, currency: bill.currency,
    detail: (bill.next < clock.today ? "Past schedule · " : "Due ") + bill.next + (bill.auto ? " · Scheduled" : " · Estimated amount"),
    href: "/?tab=planning#schedule-" + encodeURIComponent(bill.id), due: bill.next, relevant: bill.next <= through,
  });
  const { rows: members } = await tx.query<{ id: string; name: string }>(`SELECT u.id,coalesce(nullif(u.name,''),'Member') AS name
    FROM workspace_members m JOIN users u ON u.id=m.user_id WHERE m.workspace_id=$1
    AND m.role IN ('owner','member','viewer') ORDER BY u.id`, [scope.workspace]);
  const { rows: splits } = await tx.query<{ id: string; creditorId: string; debtorId: string; amount: number; note: string }>(`
    SELECT id,creditor_id AS "creditorId",debtor_id AS "debtorId",amount::float8,note FROM splits
    WHERE workspace_id=$1 AND settled_at IS NULL ORDER BY id FOR SHARE`, [scope.workspace]);
  const split: SplitData = { meId: scope.actor, reimbursementWorkspace: scope.workspace, otherMembers: members.filter(m => m.id !== scope.actor), splits, balances: [] };
  const checkIn = weeklyHouseholdCheckIn(scope.workspace, clock.today, split, [], [])!;
  for (const pair of checkIn.reimbursements) {
    const ids = JSON.parse(pair.key) as string[];
    const facts = splits.filter(row => ids.includes(row.creditorId) && ids.includes(row.debtorId));
    result.push({
      key: "reimbursement:" + hash(ids), revision: hash([clock.currency, pair.label, facts]), kind: "reimbursement",
      title: pair.label, amount: pair.amount.toFixed(2), currency: clock.currency, detail: "Outstanding shared expenses", due: null, relevant: true,
      href: "/?tab=planning#shared-expenses",
    });
  }
  const goals = await tx.query<{ id: string; name: string; target_amount: string; confirmed: string; opening: string; reviewed: boolean; deadline: string | null }>(
    goalProgressSelect + ` WHERE g.workspace_id=$1 AND NOT EXISTS (
      SELECT 1 FROM goal_reservations r WHERE r.workspace_id=$1 AND r.goal_id=g.id
        AND NOT EXISTS(SELECT 1 FROM accounts a WHERE a.id=r.account_id AND a.workspace_id=$1))
      ORDER BY g.deadline NULLS LAST,g.id FOR SHARE OF g`, [scope.workspace]);
  for (const goal of goals.rows) {
    const remaining = moneyCents(String(goal.target_amount)) - moneyCents(goal.confirmed);
    result.push({
      key: "goal:" + goal.id, revision: hash([clock.currency, goal.name, String(goal.target_amount), goal.confirmed, goal.opening, goal.reviewed, goal.deadline]),
      kind: "goal", title: goal.name, amount: decimalMoney(remaining > BigInt(0) ? remaining : BigInt(0)), currency: clock.currency,
      detail: (remaining > BigInt(0) ? "Still to save" : "Target reached") + (goal.deadline ? " · Target " + goal.deadline : "")
        + (!goal.reviewed && moneyCents(goal.opening) !== BigInt(0) ? " · Opening amount needs review" : ""),
      href: "/?tab=planning#goal-" + encodeURIComponent(goal.id), due: goal.deadline, relevant: remaining > BigInt(0),
    });
  }
  return { today: clock.today, sources: result };
}

async function readProgress(tx: HouseholdTransaction, scope: Scope, lock = false): Promise<Progress> {
  const { rows: [state] } = await tx.query<Progress>(`SELECT version,decisions FROM weekly_review_progress
    WHERE workspace_id=$1 AND actor_id=$2` + (lock ? " FOR UPDATE" : ""), [scope.workspace, scope.actor]);
  return state ?? { version: 0, decisions: {} };
}

async function view(tx: HouseholdTransaction, scope: Scope, state: Progress, canEdit: boolean, now: Date): Promise<WeeklyReviewData> {
  const current = await sources(tx, scope, now);
  const items = reviewItems(current.sources, state.decisions, current.today);
  const { rows: receipts } = await tx.query<{ id: string; at: string; items: ReceiptItem[] }>(`SELECT id,
    to_char(completed_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS at,items
    FROM weekly_review_receipts WHERE workspace_id=$1 AND actor_id=$2 ORDER BY completed_at DESC,id DESC LIMIT 5`, [scope.workspace, scope.actor]);
  const visible = new Map(current.sources.map(source => [source.key, source]));
  return {
    available: true, version: state.version, today: current.today, canEdit, items,
    digest: hash(items.map(item => [item.key, item.revision, item.status, item.until])),
    receipts: receipts.map(receipt => ({
      id: receipt.id, at: receipt.at,
      // Resolve labels and links from today's permissions. Deleted or hidden sources expose no historical details or counts.
      items: receipt.items.flatMap(item => {
        const source = visible.get(item.key);
        return source ? [{ key: item.key, title: source.title, href: source.href, choice: item.choice, changed: item.revision !== source.revision }] : [];
      }),
    })),
  };
}

export async function loadWeeklyReview(db: HouseholdDb, scope: Scope, now = new Date()) {
  return db.transaction(async tx => {
    const canEdit = await authorize(tx, scope, false);
    if (!await installed(tx)) return null;
    return view(tx, scope, await readProgress(tx, scope), canEdit, now);
  });
}

async function editing(tx: HouseholdTransaction, scope: Scope) {
  await authorize(tx, scope, true);
  if (!await installed(tx)) throw new WeeklyReviewError("Weekly review is not available yet.");
  await tx.query("INSERT INTO weekly_review_progress(workspace_id,actor_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [scope.workspace, scope.actor]);
  return readProgress(tx, scope, true);
}

export async function chooseWeeklyReview(db: HouseholdDb, scope: Scope, input: unknown, now = new Date()) {
  const choice = choiceInput.parse(input);
  return db.transaction(async tx => {
    const state = await editing(tx, scope);
    const current = await view(tx, scope, state, true, now);
    const item = current.items.find(item => item.key === choice.key);
    if (!item || item.revision !== choice.revision) throw new WeeklyReviewError("This item changed. Refresh the review before deciding.");
    if (state.version !== choice.version) {
      if (state.version === choice.version + 1 && item.status === choice.choice) return current;
      throw new WeeklyReviewError("Your review changed in another tab. Refresh before continuing.");
    }
    const decisions = { ...state.decisions };
    if (choice.choice === "pending") delete decisions[item.key];
    else decisions[item.key] = { revision: item.revision, choice: choice.choice,
      until: choice.choice === "deferred" ? format(addDays(parseISO(current.today), 7), "yyyy-MM-dd") : null };
    await tx.query("UPDATE weekly_review_progress SET decisions=$3::jsonb,version=version+1 WHERE workspace_id=$1 AND actor_id=$2",
      [scope.workspace, scope.actor, JSON.stringify(decisions)]);
    return view(tx, scope, { version: state.version + 1, decisions }, true, now);
  });
}

export async function finishWeeklyReview(db: HouseholdDb, scope: Scope, input: unknown, now = new Date()) {
  const request = finishInput.parse(input);
  const requestHash = hash([request.version, request.digest]);
  return db.transaction(async tx => {
    const state = await editing(tx, scope);
    const { rows: [prior] } = await tx.query<{ request_hash: string }>(`SELECT request_hash FROM weekly_review_receipts
      WHERE workspace_id=$1 AND actor_id=$2 AND id=$3`, [scope.workspace, scope.actor, request.id]);
    if (prior) {
      if (prior.request_hash !== requestHash) throw new WeeklyReviewError("This receipt belongs to a different review. Refresh before finishing.");
      return view(tx, scope, state, true, now);
    }
    const current = await view(tx, scope, state, true, now);
    if (state.version !== request.version || current.digest !== request.digest) throw new WeeklyReviewError("Something changed during your review. Refresh to see what needs attention.");
    const items = current.items.map(item => ({ key: item.key, revision: item.revision, choice: item.status }));
    await tx.query(`INSERT INTO weekly_review_receipts(workspace_id,actor_id,id,request_hash,items,completed_at)
      VALUES ($1,$2,$3,$4,$5::jsonb,$6)`, [scope.workspace, scope.actor, request.id, requestHash, JSON.stringify(items), now.toISOString()]);
    await tx.query("UPDATE weekly_review_progress SET version=version+1 WHERE workspace_id=$1 AND actor_id=$2", [scope.workspace, scope.actor]);
    return view(tx, scope, { ...state, version: state.version + 1 }, true, now);
  });
}
