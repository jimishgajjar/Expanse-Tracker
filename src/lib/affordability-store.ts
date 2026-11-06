import { createHash } from "node:crypto";
import { z } from "zod";
import { forecastBalances } from "./balance-forecast";
import { eligibleCash } from "./cash-eligibility";
import type { HouseholdDb, HouseholdTransaction } from "./household-db";
import { authorizePlanning, PlanningError, type PlanningScope } from "./monthly-planning";
import { decimalMoney, moneyCents, statementAmount, statementDate } from "./statement-review";
import { comparePlan, evaluatePurchase, type EvidenceRow, type PlanEvidence, type PlanOptions } from "./affordability-model";

const hash=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const ref=z.string().min(1).max(128);
export const planOptions=z.object({account:ref,horizon:z.enum(["payday","30","60","90"]),scenario:z.enum(["base","conservative"]),includeExpectedPay:z.boolean()});
const purchaseInput=z.object({options:planOptions,amount:statementAmount.refine(v=>moneyCents(v)>BigInt(0)),date:statementDate});
const saveInput=z.object({id:z.uuid(),options:planOptions,fingerprint:z.string().regex(/^[a-f0-9]{64}$/)});
const signature=(note:string,type:string,category:string|null)=>note.trim()?hash([note.trim().toLowerCase(),type,category]):"";
const inTransaction=(tx:HouseholdTransaction):HouseholdDb=>({query:(sql,p)=>tx.query(sql,p),transaction:work=>work(tx)});
const installed=async(tx:HouseholdTransaction)=>(await tx.query<{ready:boolean}>("SELECT to_regclass('public.forecast_baselines') IS NOT NULL AS ready")).rows[0].ready;

async function clock(tx:HouseholdTransaction,s:PlanningScope,now:Date){
  return (await tx.query<{today:string;currency:string}>(`SELECT
    ($2::timestamptz AT TIME ZONE coalesce((SELECT timezone FROM household_setup WHERE workspace_id=$1),'UTC'))::date::text AS today,
    coalesce((SELECT currency FROM finance_books WHERE workspace_id=$1),(SELECT currency_code FROM app_settings WHERE workspace_id=$1),'INR') AS currency`,[s.workspace,now.toISOString()])).rows[0];
}
async function accountAccess(tx:HouseholdTransaction,s:PlanningScope,account:string){
  const result=await tx.query<{id:string;name:string;initial:string}>(`SELECT id,name,initial_balance::text AS initial FROM accounts a
    WHERE workspace_id=$1 AND id=$2 AND ${eligibleCash} FOR SHARE`,[s.workspace,account]);
  if(!result.rows.length)throw new PlanningError("Choose an active cash account in the current tracker.");
  return result.rows[0];
}
async function ledgerEvidence(tx:HouseholdTransaction,s:PlanningScope,account:string){
  const rows=await tx.query<{key:string;date:string;change:string;note:string;type:string;category:string|null;refund:boolean}>(`
    SELECT 'entry-'||t.id AS key,t.date::text,(CASE WHEN t.type='expense' THEN -t.amount ELSE t.amount END)::text AS change,t.note,t.type::text,t.category_id AS category,
      EXISTS(SELECT 1 FROM refund_links r WHERE r.workspace_id=$1 AND r.credit_id=t.id) AS refund
    FROM transactions t WHERE t.workspace_id=$1 AND t.account_id=$2
    UNION ALL
    SELECT 'transfer-'||t.id,t.date::text,
      (CASE WHEN t.to_account_id=$2 THEN t.amount ELSE 0 END-CASE WHEN t.from_account_id=$2 THEN t.amount ELSE 0 END)::text,
      t.note,'transfer',NULL,false FROM transfers t WHERE t.workspace_id=$1 AND (t.from_account_id=$2 OR t.to_account_id=$2)
    ORDER BY key`,[s.workspace,account]);
  const labels:Record<string,string>={};
  const evidence:EvidenceRow[]=rows.rows.map(row=>{
    labels[row.key]=(row.refund?"Refund · ":"")+(row.note|| (row.type==="expense"?"Recorded expense":row.type==="income"?"Recorded income":"Transfer"));
    return {key:row.key,date:row.date,change:row.change,refund:row.refund,signature:signature(row.note,row.type,row.category),fingerprint:hash(row)};
  });
  return {evidence,labels};
}
async function currencyIssues(tx:HouseholdTransaction,s:PlanningScope,account:string,currency:string,now:Date){
  const {rows:[denomination]}=await tx.query<{currency:string}>("SELECT coalesce((SELECT currency FROM account_denominations WHERE workspace_id=$1 AND account_id=$2),$3) AS currency",[s.workspace,account,currency]);
  const issues:string[]=[];
  if(denomination.currency!==currency){
    const quote=await tx.query("SELECT 1 FROM valuation_quotes WHERE workspace_id=$1 AND currency=$2 AND as_of<=$3 ORDER BY as_of DESC LIMIT 1",[s.workspace,denomination.currency,now.toISOString()]);
    if(!quote.rows.length)issues.push("Missing exchange-rate evidence for "+denomination.currency+" to "+currency+".");
    issues.push("This purchase check supports cash accounts in "+currency+". A currency-aware forecast is required for this "+denomination.currency+" account.");
  }
  const transfers=await tx.query(`SELECT 1 FROM transfers t
    LEFT JOIN account_denominations f ON f.workspace_id=t.workspace_id AND f.account_id=t.from_account_id
    LEFT JOIN account_denominations d ON d.workspace_id=t.workspace_id AND d.account_id=t.to_account_id
    LEFT JOIN finance_bookings b ON b.workspace_id=t.workspace_id AND b.transfer_id=t.id
    WHERE t.workspace_id=$1 AND (t.from_account_id=$2 OR t.to_account_id=$2)
      AND (coalesce(f.currency,$3)<>coalesce(d.currency,$3) OR b.destination_currency<>b.account_currency) LIMIT 1`,[s.workspace,account,currency]);
  if(transfers.rows.length)issues.push("Cross-currency transfers affect this account. Their converted legs need a currency-aware forecast before an affordability answer is available.");
  return issues;
}

async function capture(tx:HouseholdTransaction,s:PlanningScope,options:PlanOptions,now:Date){
  const account=await accountAccess(tx,s,options.account),time=await clock(tx,s,now);
  const blockers=await currencyIssues(tx,s,account.id,time.currency,now);
  if(blockers.length)return {account:account.name,currency:time.currency,start:time.today,blockers,plan:null,fingerprint:null,labels:{}};
  const forecast=await forecastBalances(inTransaction(tx),s,options,new Date(time.today+"T12:00:00"));
  if(!forecast.projection||!forecast.end)return {account:account.name,currency:time.currency,start:time.today,blockers:forecast.warnings,plan:null,fingerprint:null,labels:{}};
  const ledger=await ledgerEvidence(tx,s,account.id);
  const rules=await tx.query<{id:string;note:string;type:string;category:string|null}>(`SELECT id,note,type,category_id AS category FROM recurring
    WHERE workspace_id=$1 AND account_id=$2 ORDER BY id FOR SHARE`,[s.workspace,account.id]);
  const ruleMap=new Map(rules.rows.map(r=>[r.id,r])),rowMap=new Map(ledger.evidence.map(r=>[r.key,r]));
  const labels={...ledger.labels};
  const events=forecast.projection.days.flatMap(d=>d.events).filter(e=>e.source!=="Spending estimate").map(e=>{
    const rule=e.key.startsWith("rule-")?e.key.slice(5,-11):null;
    const schedule=rule?ruleMap.get(rule):null;
    labels[e.key]=e.label;
    return {key:e.key,date:e.date,change:e.change,source:e.source,rule,signature:rowMap.get(e.key)?.signature??(schedule?signature(schedule.note,schedule.type,schedule.category):"")};
  });
  const goals=await tx.query<{id:string}>(`SELECT g.id FROM goals g WHERE g.workspace_id=$1 AND EXISTS(
    SELECT 1 FROM goal_reservations r WHERE r.workspace_id=$1 AND r.goal_id=g.id AND r.account_id=$2) ORDER BY g.id FOR SHARE`,[s.workspace,account.id]);
  const issues=[...forecast.warnings];
  if(forecast.assumptions.some(a=>!a.configured))issues.push("Confirm everyday spending and the cash buffer in Scenario settings before relying on this result.");
  if(forecast.coverage.accounts.length)issues.push("Account evidence is missing or over 30 days old. Review recent activity or reconcile a statement.");
  if(forecast.coverage.bills.length)issues.push("Possible missing bills are flagged in Forecast coverage. They are not included in these totals.");
  const plan:PlanEvidence={options,start:forecast.start,end:forecast.end,currency:time.currency,opening:forecast.opening,
    daily:forecast.daily,buffer:forecast.buffer,reserved:forecast.reserved,events,known:ledger.evidence,goals:goals.rows.map(g=>g.id),rules:[...new Set(events.flatMap(e=>e.rule?[e.rule]:[]))],issues};
  return {account:account.name,currency:time.currency,start:time.today,blockers,plan,fingerprint:hash(plan),labels};
}

export async function checkAffordability(db:HouseholdDb,s:PlanningScope,raw:unknown,now=new Date()){
  const input=purchaseInput.parse(raw);
  return db.transaction(async tx=>{
    await tx.exec("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    await authorizePlanning(tx,s,false);
    const captured=await capture(tx,s,input.options,now);
    const canSave=await installed(tx);
    if(!captured.plan)return {account:captured.account,currency:captured.currency,issues:captured.blockers,calculation:null,canSave:false,fingerprint:null,start:captured.start,end:null,reserved:null,buffer:null,daily:null};
    const plan=captured.plan;
    if(input.date<plan.start||input.date>plan.end)throw new PlanningError("Choose a purchase date within this forecast period.");
    return {account:captured.account,currency:plan.currency,issues:plan.issues,calculation:evaluatePurchase(plan,input.amount,input.date,captured.labels),
      canSave,fingerprint:captured.fingerprint,start:plan.start,end:plan.end,reserved:plan.reserved,buffer:plan.buffer,daily:plan.daily};
  });
}

async function visible(tx:HouseholdTransaction,s:PlanningScope,account:string,plan:PlanEvidence){
  const scopes=await tx.query<{ok:boolean}>(`SELECT
    EXISTS(SELECT 1 FROM accounts a WHERE a.id=$2 AND a.workspace_id=$1 AND ${eligibleCash})
    AND NOT EXISTS(SELECT 1 FROM unnest($3::text[]) AS wanted(id) WHERE NOT EXISTS(SELECT 1 FROM goals g WHERE g.id=wanted.id AND g.workspace_id=$1))
    AND NOT EXISTS(SELECT 1 FROM unnest($4::text[]) AS wanted(id) WHERE NOT EXISTS(SELECT 1 FROM recurring r WHERE r.id=wanted.id AND r.workspace_id=$1 AND r.account_id=$2))
    AND NOT EXISTS(SELECT 1 FROM transactions t WHERE 'entry-'||t.id=ANY($5::text[])
      AND (t.workspace_id<>$1 OR NOT EXISTS(SELECT 1 FROM accounts a WHERE a.id=t.account_id AND a.workspace_id=$1)))
    AND NOT EXISTS(SELECT 1 FROM transfers t WHERE 'transfer-'||t.id=ANY($5::text[])
      AND (t.workspace_id<>$1 OR NOT EXISTS(SELECT 1 FROM accounts a WHERE a.id=t.from_account_id AND a.workspace_id=$1)
        OR NOT EXISTS(SELECT 1 FROM accounts a WHERE a.id=t.to_account_id AND a.workspace_id=$1))) AS ok`,[s.workspace,account,plan.goals,plan.rules,plan.known.map(row=>row.key)]);
  return scopes.rows[0].ok;
}
export async function saveForecastBaseline(db:HouseholdDb,s:PlanningScope,raw:unknown,now=new Date()){
  const input=saveInput.parse(raw),requestHash=hash([input.options,input.fingerprint]);
  return db.transaction(async tx=>{
    await tx.exec("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    await authorizePlanning(tx,s,true);
    await accountAccess(tx,s,input.options.account);
    if(!await installed(tx))throw new PlanningError("Saving forecast comparisons is not available on this server yet.");
    const prior=await tx.query<{request_hash:string}>("SELECT request_hash FROM forecast_baselines WHERE workspace_id=$1 AND actor_id=$2 AND id=$3",[s.workspace,s.actor,input.id]);
    if(prior.rows.length){
      if(prior.rows[0].request_hash!==requestHash)throw new PlanningError("This save request belongs to another forecast. Recalculate first.");
      return {id:input.id};
    }
    const captured=await capture(tx,s,input.options,now);
    if(!captured.plan||captured.fingerprint!==input.fingerprint)throw new PlanningError("The forecast changed. Recalculate the purchase check before saving the original plan.");
    const insert=await tx.query(`INSERT INTO forecast_baselines(workspace_id,actor_id,id,account_id,request_hash,evidence,created_at)
      VALUES($1,$2,$3,$4,$5,$6::jsonb,$7) ON CONFLICT DO NOTHING RETURNING id`,[s.workspace,s.actor,input.id,input.options.account,requestHash,JSON.stringify(captured.plan),now.toISOString()]);
    if(!insert.rows.length)throw new PlanningError("Another request saved this review. Refresh your saved plans.");
    return {id:input.id};
  });
}
export async function listForecastBaselines(db:HouseholdDb,s:PlanningScope,account:string){
  ref.parse(account);
  return db.transaction(async tx=>{
    await authorizePlanning(tx,s,false);await accountAccess(tx,s,account);
    if(!await installed(tx))return {available:false,items:[]};
    const {rows}=await tx.query<{id:string;at:string;evidence:PlanEvidence}>(`SELECT id,to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS at,evidence FROM forecast_baselines
      WHERE workspace_id=$1 AND actor_id=$2 AND account_id=$3 ORDER BY created_at DESC,id DESC LIMIT 10`,[s.workspace,s.actor,account]);
    const items=[];
    for(const row of rows)if(await visible(tx,s,account,row.evidence))items.push({id:row.id,at:row.at,start:row.evidence.start,end:row.evidence.end,scenario:row.evidence.options.scenario});
    return {available:true,items};
  });
}
export async function compareForecastBaseline(db:HouseholdDb,s:PlanningScope,account:string,id:string,now=new Date()){
  ref.parse(account);z.uuid().parse(id);
  return db.transaction(async tx=>{
    await tx.exec("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    await authorizePlanning(tx,s,false);const current=await accountAccess(tx,s,account);
    if(!await installed(tx))throw new PlanningError("Saved forecast comparisons are unavailable.");
    const {rows:[saved]}=await tx.query<{evidence:PlanEvidence}>("SELECT evidence FROM forecast_baselines WHERE workspace_id=$1 AND actor_id=$2 AND account_id=$3 AND id=$4",[s.workspace,s.actor,account,id]);
    if(!saved||!await visible(tx,s,account,saved.evidence))throw new PlanningError("This saved plan is unavailable with your current source access.");
    const plan=saved.evidence,time=await clock(tx,s,now);
    if(time.currency!==plan.currency||(await currencyIssues(tx,s,account,time.currency,now)).length)throw new PlanningError("Currency setup changed. A comparison in the original currency is unavailable.");
    if(time.today<plan.start)throw new PlanningError("This saved period has not started yet.");
    const ledger=await ledgerEvidence(tx,s,account),labels={...ledger.labels};
    const rules=await tx.query<{id:string;note:string}>("SELECT id,note FROM recurring WHERE workspace_id=$1 AND account_id=$2",[s.workspace,account]);
    const names=new Map(rules.rows.map(r=>[r.id,r.note]));
    for(const event of plan.events)if(event.rule)labels[event.key]=names.get(event.rule)||"Saved bill estimate";
    const through=time.today<plan.end?time.today:plan.end;
    const comparison=comparePlan(plan,ledger.evidence,current.initial,through,labels);
    const total=comparison.lines.reduce((sum,line)=>sum+moneyCents(line.difference),BigInt(0));
    if(decimalMoney(total)!==comparison.difference)throw new PlanningError("This comparison needs investigation before it can be shown.");
    return {account:current.name,currency:plan.currency,start:plan.start,end:plan.end,issues:plan.issues,...comparison};
  });
}
