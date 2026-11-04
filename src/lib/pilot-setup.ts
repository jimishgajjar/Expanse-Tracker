import { randomUUID } from "node:crypto";
import { z } from "zod";
import { findCurrencyByCode } from "./currencies";
import type { HouseholdDb, HouseholdReader } from "./household-db";

type Scope = {workspace:string; actor:string};
export class PilotProblem extends Error {}
type Account = {id:string; name:string; cutoff:string|null; reviewed:boolean};
type Progress = {timezone:string|null; currency:string; bills:boolean; partner:boolean; reconciled:boolean; bills_skipped:boolean; invite_skipped:boolean; owner:boolean; accounts:Account[]};
export type Opening = {count:number; opening:string; balance:string; cutoff:string|null};

async function access(db:HouseholdReader, s:Scope, owner=false) {
  const {rows} = await db.query<{owner:boolean}>(`SELECT m.role='owner' AND w.owner_id=m.user_id AS owner
    FROM workspace_members m JOIN workspaces w ON w.id=m.workspace_id
    WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.role IN ('owner','member','viewer') FOR SHARE OF m`,[s.workspace,s.actor]);
  if (!rows.length || (owner && !rows[0].owner)) throw new PilotProblem("Reopen this household. Only its owner can change setup.");
  return rows[0].owner;
}

export async function setupProgress(db:HouseholdDb,s:Scope):Promise<Progress> {
  return db.transaction(async tx=>{
    const owner=await access(tx,s);
    const {rows:[state]}=await tx.query<Omit<Progress,"owner"|"accounts">>(`SELECT
      (SELECT timezone FROM household_setup WHERE workspace_id=$1) AS timezone,
      coalesce((SELECT currency_code FROM app_settings WHERE workspace_id=$1),'INR') AS currency,
      EXISTS(SELECT 1 FROM recurring WHERE workspace_id=$1) AS bills,
      (EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id=$1 AND user_id<>(SELECT owner_id FROM workspaces WHERE id=$1))
        OR EXISTS(SELECT 1 FROM invitations WHERE workspace_id=$1)) AS partner,
      EXISTS(SELECT 1 FROM reconciliation_sessions WHERE workspace_id=$1 AND status='completed') AS reconciled,
      coalesce((SELECT bills_skipped FROM household_setup WHERE workspace_id=$1),false) AS bills_skipped,
      coalesce((SELECT invite_skipped FROM household_setup WHERE workspace_id=$1),false) AS invite_skipped`,[s.workspace]);
    const {rows:accounts}=await tx.query<Account>(`SELECT a.id,a.name,c.through_date::text AS cutoff, EXISTS(SELECT 1 FROM finance_accounts f WHERE f.workspace_id=a.workspace_id AND f.account_id=a.id) AS reviewed FROM accounts a
      LEFT JOIN opening_cutoffs c ON c.account_id=a.id AND c.workspace_id=a.workspace_id
      WHERE a.workspace_id=$1 AND NOT a.archived ORDER BY a.name,a.id`,[s.workspace]);
    return {...state,owner,accounts};
  });
}

export async function savePreferences(db:HouseholdDb,s:Scope,currency:string,timezone:string,bills:boolean,invite:boolean) {
  if (!findCurrencyByCode(currency) || !timezone || timezone.length>80) throw new PilotProblem("Choose a listed currency and enter a time zone such as America/Toronto.");
  let zone:string;
  try {zone=new Intl.DateTimeFormat("en",{timeZone:timezone}).resolvedOptions().timeZone;} catch {throw new PilotProblem("Enter a time zone such as America/Toronto or UTC.");}
  await db.transaction(async tx=>{
    await access(tx,s,true);
    await tx.query("INSERT INTO app_settings(workspace_id,currency_code) VALUES ($1,$2) ON CONFLICT(workspace_id) DO UPDATE SET currency_code=excluded.currency_code",[s.workspace,currency]);
    await tx.query(`INSERT INTO household_setup(workspace_id,timezone,bills_skipped,invite_skipped) VALUES($1,$2,$3,$4)
      ON CONFLICT(workspace_id) DO UPDATE SET timezone=excluded.timezone,bills_skipped=excluded.bills_skipped,invite_skipped=excluded.invite_skipped`,[s.workspace,zone,bills,invite]);
  });
}

export async function reviewOpening(db:HouseholdDb,s:Scope,account:string,date:string,statement?:string):Promise<Opening> {
  if (!z.iso.date().safeParse(date).success) throw new PilotProblem("Enter the closing date printed on the statement.");
  if (statement!==undefined && !/^-?\d{1,12}(\.\d{1,2})?$/.test(statement)) throw new PilotProblem("Enter the statement balance with up to two decimal places.");
  return db.transaction(async tx=>{
    await access(tx,s,true);
    // Same lock order as file approval. Recompute from ledger rows for every confirmation.
    await tx.query("SELECT pg_advisory_xact_lock(hashtextextended('file-import:'||$1,0))",[s.workspace]);
    const {rows:[a]}=await tx.query("SELECT id FROM accounts WHERE workspace_id=$1 AND id=$2 AND NOT archived FOR UPDATE",[s.workspace,account]);
    if (!a) throw new PilotProblem("Choose an active account from this household.");
    const {rows:[day]}=await tx.query<{future:boolean}>("SELECT $2::date>(now() AT TIME ZONE coalesce((SELECT timezone FROM household_setup WHERE workspace_id=$1),'UTC'))::date AS future",[s.workspace,date]);
    if (day.future) throw new PilotProblem("Choose a statement that has already closed in your household time zone.");
    if ((await tx.query("SELECT 1 FROM finance_accounts WHERE workspace_id=$1 AND account_id=$2",[s.workspace,account])).rows.length)
      throw new PilotProblem("This account has a reviewed financial position. Record its statement under Debt & currencies.");
    const {rows:[row]}=await tx.query<Opening & {matches:boolean}>(`WITH movement AS (
      SELECT CASE WHEN type='income' THEN amount ELSE -amount END AS net FROM transactions WHERE workspace_id=$1 AND account_id=$2 AND date<=$3::date
      UNION ALL SELECT (CASE WHEN to_account_id=$2 THEN amount ELSE 0 END)-(CASE WHEN from_account_id=$2 THEN amount ELSE 0 END)
      FROM transfers WHERE workspace_id=$1 AND (from_account_id=$2 OR to_account_id=$2) AND date<=$3::date
    ), ledger AS (SELECT count(*)::int AS count,coalesce(sum(net),0) AS delta FROM movement)
    SELECT ledger.count,a.initial_balance::text AS opening,(a.initial_balance+delta)::text AS balance,
      c.through_date::text AS cutoff,(a.initial_balance+delta=$4::numeric) AS matches
      FROM ledger,accounts a LEFT JOIN opening_cutoffs c ON c.account_id=a.id AND c.workspace_id=a.workspace_id WHERE a.id=$2 AND a.workspace_id=$1`,
      [s.workspace,account,date,statement??null]);
    if (statement!==undefined) {
      if (!row.matches) throw new PilotProblem("The statement and tracker differ. Check your opening balance and activity, or reconcile the difference first.");
      if (row.cutoff && row.cutoff!==date) throw new PilotProblem("An opening date is already recorded. Use statement reconciliation for later dates.");
      await tx.query("INSERT INTO opening_cutoffs(workspace_id,account_id,through_date,statement_balance) VALUES($1,$2,$3,$4) ON CONFLICT(account_id) DO NOTHING",[s.workspace,account,date,statement]);
    }
    return {count:row.count,opening:row.opening,balance:row.balance,cutoff:statement===undefined?row.cutoff:date};
  });
}

export const severity = z.enum(["suggestion","blocked","financial","privacy"]);

export async function recordFeedback(db:HouseholdDb,s:Scope,kind:string,body:string) {
  const message=body.trim();
  if (!severity.safeParse(kind).success || message.length<5 || message.length>800) throw new PilotProblem("Choose a topic and describe the issue in 5 to 800 characters.");
  return db.transaction(async tx=>{
    await access(tx,s);
    await tx.query("SELECT pg_advisory_xact_lock(hashtextextended('pilot-feedback:'||$1,0))",[s.actor]);
    const {rows:[limit]}=await tx.query("SELECT count(*)::int AS used FROM pilot_feedback WHERE actor=$1 AND created_at>now()-interval '1 hour'",[s.actor]);
    if (Number(limit.used)>=5) throw new PilotProblem("You have sent five reports this hour. Try again later.");
    const id=randomUUID();
    await tx.query("INSERT INTO pilot_feedback(id,workspace_id,actor,severity,message) VALUES($1,$2,$3,$4,$5)",[id,s.workspace,s.actor,kind,message]);
    return id;
  });
}
