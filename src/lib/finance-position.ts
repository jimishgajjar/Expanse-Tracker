import { converted, minor, money, payoff } from "./finance-money";
import type { HouseholdDb, HouseholdTransaction } from "./household-db";

export type FinanceScope = {workspace:string;actor:string};
export async function financeAccess(tx:HouseholdTransaction,s:FinanceScope,access:"read"|"write"|"owner") {
  const {rows:[member]}=await tx.query<{role:string;owner:string}>(`SELECT m.role,w.owner_id AS owner
    FROM workspace_members m JOIN workspaces w ON w.id=m.workspace_id
    WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.role IN ('owner','member','viewer') FOR SHARE OF m,w`,[s.workspace,s.actor]);
  if (!member || (access==="write" && member.role==="viewer") ||
      (access==="owner" && (member.role!=="owner" || member.owner!==s.actor))) throw Error("You do not have access to this action.");
  return member.role;
}

export type FinanceAccount = {id:string;name:string;archived:boolean;role:string|null;currency:string|null;
  raw:string;balance:string;uncertain:boolean;rate:string|null;quote_date:string|null;quote_source:string|null};
// Only a confirmed receipt can change the destination leg. Earlier foreign or unreviewed
// source legs stay visible as uncertain rather than becoming a made-up destination amount.
export const accountPositions = `WITH movements AS (
  SELECT account_id AS id, CASE WHEN type='income' THEN amount ELSE -amount END delta,false uncertain
    FROM transactions WHERE workspace_id=$1 AND date<=CURRENT_DATE
  UNION ALL SELECT from_account_id,-amount,false FROM transfers WHERE workspace_id=$1 AND date<=CURRENT_DATE
  UNION ALL SELECT t.to_account_id,coalesce(b.received,t.amount),
    b.id IS NULL AND src.currency IS DISTINCT FROM dst.currency
    FROM transfers t LEFT JOIN finance_bookings b ON b.transfer_id=t.id AND b.workspace_id=t.workspace_id
    LEFT JOIN account_denominations src ON src.workspace_id=t.workspace_id AND src.account_id=t.from_account_id
    LEFT JOIN account_denominations dst ON dst.workspace_id=t.workspace_id AND dst.account_id=t.to_account_id
    WHERE t.workspace_id=$1 AND t.date<=CURRENT_DATE
), movement_totals AS (SELECT id,sum(delta) delta,bool_or(uncertain) uncertain FROM movements GROUP BY id)
 SELECT a.id,a.name,a.archived,p.role,d.currency,(a.initial_balance+coalesce(m.delta,0))::text AS raw,
   (a.initial_balance+coalesce(m.delta,0)+coalesce(p.adjustment,0))::text AS balance,
   (coalesce(m.uncertain,false) OR (d.currency='JPY' AND a.initial_balance+coalesce(m.delta,0)<>trunc(a.initial_balance+coalesce(m.delta,0)))) IS TRUE AS uncertain,
   q.rate::text,q.as_of::text AS quote_date,q.source AS quote_source
 FROM accounts a LEFT JOIN movement_totals m ON m.id=a.id
 LEFT JOIN finance_accounts p ON p.account_id=a.id AND p.workspace_id=a.workspace_id
 LEFT JOIN account_denominations d ON d.account_id=a.id AND d.workspace_id=a.workspace_id
 LEFT JOIN LATERAL (SELECT rate,as_of,source FROM valuation_quotes WHERE workspace_id=a.workspace_id
   AND currency=d.currency AND as_of<=now() ORDER BY as_of DESC LIMIT 1) q ON true
 WHERE a.workspace_id=$1 ORDER BY a.archived,a.name,a.id`;

export function valuedPosition(accounts:FinanceAccount[],report:string) {
  const missing:string[]=[], native:Record<string,bigint>={};
  let cash=BigInt(0), debt=BigInt(0), worth=BigInt(0);
  for (const a of accounts) {
    if (!a.currency || !a.role || a.uncertain) { missing.push(a.name); continue; }
    const units=minor(a.balance,a.currency);
    native[a.currency]=(native[a.currency]??BigInt(0))+units;
    if (units===BigInt(0)) continue;
    if (a.currency!==report && !a.rate) {missing.push(a.name);continue;}
    const value=minor(converted(a.balance,a.currency,report,a.currency===report?"1":a.rate!),report);
    worth+=value;
    if (a.role==="cash") cash+=value;
    if ((a.role==="card" || a.role==="loan") && value<BigInt(0)) debt-=value;
  }
  return {cash:missing.length?null:money(cash,report),debt:missing.length?null:money(debt,report),
    worth:missing.length?null:money(worth,report),missing,
    native:Object.fromEntries(Object.entries(native).map(([code,amount])=>[code,money(amount,code)]))};
}

type Statement={account_id:string;starts:string;ends:string;due:string;closing:string;minimum:string};
type Terms={account_id:string;apr:string;payment:string;monthly_fee:string;variable:boolean};
export async function financeReport(db:HouseholdDb,s:FinanceScope,detail=false) {
  return db.transaction(async tx=>{
    await tx.exec("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    const role=await financeAccess(tx,s,"read");
    const {rows:[book]}=await tx.query<{currency:string}>("SELECT currency FROM finance_books WHERE workspace_id=$1",[s.workspace]);
    const accounts=(await tx.query<FinanceAccount>(accountPositions,[s.workspace])).rows;
    const report=book?.currency??null;
    const {rows:statements}=await tx.query<Statement>("SELECT account_id,starts::text,ends::text,due::text,closing::text,minimum::text FROM debt_statements WHERE workspace_id=$1 ORDER BY ends DESC",[s.workspace]);
    const {rows:terms}=await tx.query<Terms>("SELECT account_id,apr::text,payment::text,monthly_fee::text,variable FROM loan_terms WHERE workspace_id=$1",[s.workspace]);
    const flows=(await tx.query<{income:string;spending:string;missing:number}>(`WITH activity AS (
      SELECT t.type,coalesce(b.kind,CASE WHEN r.credit_id IS NOT NULL THEN 'refund' ELSE t.type::text END) kind,
        CASE WHEN d.currency='JPY' AND t.amount<>trunc(t.amount) THEN NULL WHEN b.id IS NOT NULL THEN b.reporting_amount WHEN d.currency=$2 THEN t.amount END value
      FROM transactions t LEFT JOIN finance_bookings b ON b.workspace_id=t.workspace_id AND b.transaction_id=t.id
      LEFT JOIN account_denominations d ON d.workspace_id=t.workspace_id AND d.account_id=t.account_id
      LEFT JOIN refund_links r ON r.workspace_id=t.workspace_id AND r.credit_id=t.id WHERE t.workspace_id=$1 AND t.date<=CURRENT_DATE
    ) SELECT coalesce(sum(value) FILTER(WHERE type='income' AND kind<>'refund'),0)::text income,
      coalesce(sum(CASE WHEN kind='refund' THEN -value ELSE value END) FILTER(WHERE type='expense' OR kind='refund'),0)::text spending,
      count(*) FILTER(WHERE value IS NULL)::int missing FROM activity`,[s.workspace,report])).rows[0];
    const projections=terms.map(t=>{
      const a=accounts.find(a=>a.id===t.account_id)!;
      return {...t,scenario:a.currency && !a.uncertain ? payoff(money(-minor(a.balance,a.currency),a.currency),a.currency,t.apr,t.payment,t.monthly_fee):null};
    });
    type Entry={id:string;posted:string;account:string;destination:string|null;kind:string;amount:string;note:string;booked:boolean;report_value:string|null;received:string|null};
    const entries=detail?(await tx.query<Entry>(`SELECT t.id,t.date::text posted,t.account_id account,NULL::text destination,
        coalesce(b.kind,t.type::text) kind,t.amount::text,t.note,b.id IS NOT NULL booked,b.reporting_amount::text report_value,NULL::text received FROM transactions t
        LEFT JOIN finance_bookings b ON b.workspace_id=t.workspace_id AND b.transaction_id=t.id WHERE t.workspace_id=$1
      UNION ALL SELECT t.id,t.date::text,t.from_account_id,t.to_account_id,coalesce(b.kind,'transfer'),t.amount::text,t.note,b.id IS NOT NULL,b.reporting_amount::text,b.received::text
        FROM transfers t LEFT JOIN finance_bookings b ON b.workspace_id=t.workspace_id AND b.transfer_id=t.id WHERE t.workspace_id=$1
      ORDER BY posted DESC,id LIMIT 100`,[s.workspace])).rows:[];
    const visibleAccounts=new Set(accounts.map(a=>a.id));
    const visibleEntries=entries.map(e=>({...e,account:visibleAccounts.has(e.account)?e.account:"",
      destination:e.destination && visibleAccounts.has(e.destination)?e.destination:null}));
    return {role,report,accounts,position:report?valuedPosition(accounts,report):null,flows,statements,projections,entries:visibleEntries};
  });
}
export type FinanceReport = Awaited<ReturnType<typeof financeReport>>;
