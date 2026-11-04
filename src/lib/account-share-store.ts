import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { HouseholdDb, HouseholdTransaction } from "./household-db";
import { DEFAULT_CURRENCY_CODE } from "./currencies";

export type ShareScope = { workspace: string; actor: string; sessionId: string };
export type ReportLine = {
  date: string; kind: "income" | "expense" | "transfer in" | "transfer out";
  amount: string; note: string; category: string; photo: string | null; fingerprint: string | null;
};
export type AccountReport = { name: string; currency: string; opening: string; balance: string; lines: ReportLine[] };
export type Recipient = { id: string; name: string; email: string; role: string; revision: string | null; shared: boolean };
type ShareChoice = { account: string; recipient: string; photos: boolean };
export class ShareError extends Error {
  constructor(message: string, readonly status = 404) { super(message); }
}
const unavailable = () => new ShareError("This account share is unavailable.");
const changed = () => new ShareError("The account, recipient or sharing settings changed. Review a fresh preview.", 409);
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const eligible = "('owner','member','viewer')";

// Never derive ownership from who entered a transaction or from the household administrator role.
async function source(tx: HouseholdTransaction, scope: ShareScope, account: string) {
  const { rows: [row] } = await tx.query<{household:string; householdName:string; name:string; opening:string; currency:string; role:string; joined:string}>(`
    SELECT p.household_id AS household, w.name AS "householdName", a.name, a.initial_balance::text AS opening,
      coalesce(s.currency_code,$4) AS currency, m.role, m.created_at::text AS joined
    FROM accounts a JOIN personal_ledgers p ON p.ledger_id=a.workspace_id
    JOIN workspaces w ON w.id=p.household_id
    JOIN workspace_members m ON m.workspace_id=p.household_id AND m.user_id=p.person_id
    JOIN workspace_members own ON own.workspace_id=p.ledger_id AND own.user_id=p.person_id
    LEFT JOIN app_settings s ON s.workspace_id=p.ledger_id
    WHERE p.ledger_id=$1 AND p.person_id=$2 AND a.id=$3 AND m.role IN ${eligible} AND own.role IN ${eligible}`,
    [scope.workspace,scope.actor,account,DEFAULT_CURRENCY_CODE]);
  if (!row) throw unavailable();
  return row;
}

async function members(tx: HouseholdTransaction, household: string, actor: string, account: string) {
  return (await tx.query<Recipient & { joined: string }>(`
    SELECT u.id,u.name,u.email,m.role,m.created_at::text AS joined,s.revision,s.report IS NOT NULL AS shared
    FROM workspace_members m JOIN users u ON u.id=m.user_id
    LEFT JOIN account_shares s ON s.account_id=$3 AND s.owner_id=$2 AND s.recipient_id=u.id AND s.household_id=$1
    WHERE m.workspace_id=$1 AND m.user_id<>$2 AND m.role IN ${eligible} ORDER BY u.name,u.email,u.id`,
    [household,actor,account])).rows;
}

export function sharingOptions(db: HouseholdDb, scope: ShareScope, account: string) {
  return db.transaction(async tx => {
    const owner = await source(tx,scope,account);
    const recipients: Recipient[] = (await members(tx,owner.household,scope.actor,account)).map(
      ({id,name,email,role,revision,shared}) => ({id,name,email,role,revision,shared})
    );
    return { name: owner.name, household: owner.householdName, canShare: owner.role !== "viewer", recipients };
  });
}

async function prepare(tx: HouseholdTransaction, scope: ShareScope, choice: ShareChoice, expires: number) {
  const owner = await source(tx,scope,choice.account);
  if (owner.role === "viewer") throw unavailable();
  const recipient = (await members(tx,owner.household,scope.actor,choice.account)).find(r => r.id === choice.recipient);
  if (!recipient) throw unavailable();
  // Transfer counterparties and their free-text memos can identify a second private account.
  const { rows: lines } = await tx.query<ReportLine>(`
    SELECT date::text,kind,amount::text,note,category,photo,fingerprint FROM (
      SELECT t.date,t.type::text AS kind,t.amount,t.note,coalesce(c.name,'') AS category,r.id AS photo,
        encode(sha256(decode(r.jpeg,'base64')),'hex') AS fingerprint,t.id AS ordering
      FROM transactions t LEFT JOIN categories c ON c.id=t.category_id AND c.workspace_id=t.workspace_id
      LEFT JOIN receipt_images r ON $3 AND r.transaction_id=t.id
      WHERE t.workspace_id=$1 AND t.account_id=$2
      UNION ALL
      SELECT f.date,CASE WHEN f.to_account_id=$2 THEN 'transfer in' ELSE 'transfer out' END,
        f.amount,'','',NULL,NULL,f.id FROM transfers f
      WHERE f.workspace_id=$1 AND (f.from_account_id=$2 OR f.to_account_id=$2) AND f.from_account_id<>f.to_account_id
    ) activity ORDER BY date DESC, ordering, kind`, [scope.workspace,choice.account,choice.photos]);
  const { rows: [total] } = await tx.query<{balance:string}>(`
    SELECT (a.initial_balance +
      coalesce((SELECT sum(CASE WHEN type='income' THEN amount ELSE -amount END) FROM transactions WHERE workspace_id=$1 AND account_id=a.id),0) +
      coalesce((SELECT sum((CASE WHEN to_account_id=a.id THEN amount ELSE 0 END)-(CASE WHEN from_account_id=a.id THEN amount ELSE 0 END))
        FROM transfers WHERE workspace_id=$1 AND (from_account_id=a.id OR to_account_id=a.id)),0))::text AS balance
    FROM accounts a WHERE a.workspace_id=$1 AND a.id=$2`, [scope.workspace,choice.account]);
  const report: AccountReport = { name: owner.name, currency: owner.currency, opening: owner.opening, balance: total.balance, lines };
  const token = createHmac("sha256",scope.sessionId).update(JSON.stringify([
    "account-share-v1",scope.workspace,scope.actor,owner.household,owner.householdName,owner.joined,owner.role,
    choice.account,choice.photos,recipient.id,recipient.name,recipient.email,recipient.joined,recipient.role,recipient.revision,report,expires,
  ])).digest("hex");
  return { report, recipient, household: owner.household, householdName: owner.householdName, token };
}

export function previewAccountShare(db: HouseholdDb, scope: ShareScope, choice: ShareChoice) {
  return db.transaction(async tx => {
    const expires = Date.now()+10*60_000;
    const {report,token,recipient,householdName} = await prepare(tx,scope,choice,expires);
    return {report,token,expires,audience:{name:recipient.name,email:recipient.email,household:householdName}};
  });
}

export function confirmAccountShare(db: HouseholdDb, scope: ShareScope, choice: ShareChoice, token: string, expires: number) {
  return db.transaction(async tx => {
    await tx.exec("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");
    if (!/^[0-9a-f]{64}$/.test(token) || !Number.isSafeInteger(expires) || expires <= Date.now()) throw changed();
    const result = await prepare(tx,scope,choice,expires);
    const revision = sha(token);
    if (result.recipient.shared && result.recipient.revision === revision) return;
    if (!timingSafeEqual(Buffer.from(result.token),Buffer.from(token))) throw changed();
    await tx.query(`INSERT INTO account_shares(id,ledger_id,account_id,household_id,owner_id,recipient_id,revision,report)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) ON CONFLICT(account_id,recipient_id)
      DO UPDATE SET report=excluded.report, revision=excluded.revision, updated_at=now()`,
      [randomUUID(),scope.workspace,choice.account,result.household,scope.actor,choice.recipient,revision,JSON.stringify(result.report)]);
  });
}

export function stopAccountShare(db: HouseholdDb, scope: ShareScope, account: string, recipient: string, revision: string) {
  return db.transaction(async tx => {
    const owner = await source(tx,scope,account);
    const result = await tx.query(`UPDATE account_shares SET report=NULL, revision=$7, updated_at=now()
      WHERE ledger_id=$1 AND account_id=$2 AND owner_id=$3 AND household_id=$4 AND recipient_id=$5 AND revision=$6 RETURNING id`,
      [scope.workspace,account,scope.actor,owner.household,recipient,revision,randomUUID()]);
    if (!result.rows.length) throw changed();
  });
}

// Match both current memberships as well as the personal ledger/account link on every recipient read.
const visibleShares = `FROM account_shares s JOIN personal_ledgers p ON p.ledger_id=s.ledger_id
  AND p.household_id=s.household_id AND p.person_id=s.owner_id
  JOIN accounts a ON a.id=s.account_id AND a.workspace_id=s.ledger_id
  JOIN workspace_members reader ON reader.workspace_id=s.household_id AND reader.user_id=s.recipient_id
  JOIN workspace_members owner ON owner.workspace_id=s.household_id AND owner.user_id=s.owner_id
  JOIN users u ON u.id=s.owner_id
  WHERE s.household_id=$1 AND s.recipient_id=$2 AND s.report IS NOT NULL
  AND reader.role IN ${eligible} AND owner.role IN ${eligible}`;
export type InboxShare = { id:string; name:string; owner:string; revision:string; date:string };
export async function receivedShares(db: HouseholdDb, scope: ShareScope) {
  return (await db.query<InboxShare>(`SELECT s.id,s.report->>'name' AS name,coalesce(nullif(u.name,''),u.email) AS owner,
    s.revision,s.updated_at AS date ${visibleShares} ORDER BY s.updated_at DESC,s.id`,[scope.workspace,scope.actor])).rows;
}
export async function receivedReport(db: HouseholdDb, scope: ShareScope, id: string) {
  const {rows:[row]} = await db.query<{report:AccountReport;revision:string}>(`SELECT s.report,s.revision ${visibleShares} AND s.id=$3`,
    [scope.workspace,scope.actor,id]);
  if (!row) throw unavailable();
  return row;
}
export async function sharedPhoto(db: HouseholdDb, scope: ShareScope, id: string, revision: string, photo: string) {
  const {rows:[row]} = await db.query<{jpeg:string}>(`SELECT r.jpeg FROM receipt_images r JOIN transactions t ON t.id=r.transaction_id
    WHERE r.id=$5 AND EXISTS(SELECT 1 ${visibleShares} AND s.id=$3 AND s.revision=$4
      AND t.workspace_id=s.ledger_id AND t.account_id=s.account_id AND EXISTS(
        SELECT 1 FROM jsonb_array_elements(s.report->'lines') entry WHERE entry->>'photo'=r.id
        AND entry->>'fingerprint'=encode(sha256(decode(r.jpeg,'base64')),'hex')))`, [scope.workspace,scope.actor,id,revision,photo]);
  if (!row) throw unavailable();
  return Buffer.from(row.jpeg,"base64");
}

export async function previewPhoto(db: HouseholdDb, scope: ShareScope, account: string, photo: string, fingerprint: string) {
  return db.transaction(async tx => {
    await source(tx,scope,account);
    const {rows:[row]} = await tx.query<{jpeg:string}>(`SELECT r.jpeg FROM receipt_images r JOIN transactions t ON t.id=r.transaction_id
      WHERE t.workspace_id=$1 AND t.account_id=$2 AND r.id=$3 AND encode(sha256(decode(r.jpeg,'base64')),'hex')=$4`,
      [scope.workspace,account,photo,fingerprint]);
    if (!row) throw unavailable();
    return Buffer.from(row.jpeg,"base64");
  });
}
