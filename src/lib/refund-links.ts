import type {HouseholdDb, HouseholdReader} from "./household-db";
import {z} from "zod";
import {todayISO} from "./dates";
import {moneyCents, decimalMoney, statementAmount} from "./statement-review";
import {authorizePlanning, PlanningError, type PlanningScope} from "./monthly-planning";

type Entry = {id:string; date:string; amount:string; note:string; account:string};
type Portion = {categoryId:string|null; amount:string};
type Choice = {categoryId:string|null; name:string; remaining:string};
type Link = {id:string; purchaseId:string; portions:Portion[]};
const id = z.string().min(1).max(128);
const allocation = z.object({categoryId:id.nullable(),amount:statementAmount.refine(v=>moneyCents(v)>BigInt(0))});
const request = z.object({credit:id,purchase:id,creditAmount:statementAmount,purchaseAmount:statementAmount,creditDate:z.string(),purchaseDate:z.string(),
  portions:z.array(allocation).min(1).max(100)});
const entryFields = "t.id,t.date::text,t.amount::text,t.note,a.name AS account";
const source = "transactions t JOIN accounts a ON a.id=t.account_id AND a.workspace_id=t.workspace_id";

async function creditEntry(tx:HouseholdReader, workspace:string, credit:string){
  const row = (await tx.query<Entry>(`SELECT ${entryFields} FROM ${source}
    WHERE t.workspace_id=$1 AND t.id=$2 AND t.type='income' AND t.amount>0 AND t.date<=$3 FOR SHARE OF t`,
    [workspace,credit,todayISO()])).rows[0];
  if(!row) throw new PlanningError("Choose a posted incoming transaction in this workspace.");
  return row;
}
async function choices(tx:HouseholdReader, workspace:string, purchase:string){
  return (await tx.query<Choice>(`WITH original AS (
    SELECT coalesce(p.category_id,t.category_id) AS category,coalesce(p.amount,t.amount) AS amount
    FROM transactions t LEFT JOIN purchase_allocations p ON p.transaction_id=t.id WHERE t.workspace_id=$1 AND t.id=$2
  ), returned AS (
    SELECT x->>'categoryId' AS category,sum((x->>'amount')::numeric) AS amount
    FROM refund_links r CROSS JOIN LATERAL jsonb_array_elements(r.portions) x
    WHERE r.workspace_id=$1 AND r.purchase_id=$2 GROUP BY 1
  ) SELECT o.category AS "categoryId",coalesce(c.name,'Uncategorized') AS name,(o.amount-coalesce(r.amount,0))::text AS remaining
    FROM original o LEFT JOIN returned r ON r.category IS NOT DISTINCT FROM o.category
    LEFT JOIN categories c ON c.id=o.category AND c.workspace_id=$1 ORDER BY name,o.category`,[workspace,purchase])).rows;
}

export async function refundReview(db:HouseholdDb,s:PlanningScope,credit:string,search="",purchase=""){
  return db.transaction(async tx=>{
    await authorizePlanning(tx,s,false);
    const incoming=await creditEntry(tx,s.workspace,id.parse(credit));
    const link=(await tx.query<Link>(`SELECT id,purchase_id AS "purchaseId",portions FROM refund_links WHERE workspace_id=$1 AND credit_id=$2`,[s.workspace,credit])).rows[0]??null;
    const selected=link?.purchaseId||purchase;
    const purchases=(await tx.query<Entry>(`SELECT ${entryFields} FROM ${source}
      WHERE t.workspace_id=$1 AND t.type='expense' AND t.date<=$2 AND t.amount>=$3
      AND (($4<>'' AND t.id=$4) OR ($4='' AND t.amount-coalesce((
        SELECT sum(c.amount) FROM refund_links r JOIN transactions c ON c.id=r.credit_id
        WHERE r.purchase_id=t.id AND r.workspace_id=t.workspace_id),0)>=$3 AND position(lower($5) in lower(concat_ws(' ',t.note,t.date::text,a.name,t.amount::text)))>0))
      ORDER BY t.date DESC,t.id LIMIT 50`,[s.workspace,incoming.date,incoming.amount,selected,search.trim().slice(0,160)])).rows;
    return {incoming,link,purchases,choices:selected&&purchases.length?await choices(tx,s.workspace,selected):[]};
  });
}

export async function linkRefund(db:HouseholdDb,s:PlanningScope,raw:unknown){
  const input=request.parse(raw);
  await db.transaction(async tx=>{
    await authorizePlanning(tx,s,true);
    const incoming=await creditEntry(tx,s.workspace,input.credit);
    const purchase=(await tx.query<{date:string;amount:string}>(`SELECT date::text,amount::text FROM transactions WHERE workspace_id=$1 AND id=$2 AND type='expense' AND date<=$3 FOR UPDATE`,[s.workspace,input.purchase,incoming.date])).rows[0];
    if(!purchase||moneyCents(purchase.amount)!==moneyCents(input.purchaseAmount)||purchase.date!==input.purchaseDate||incoming.date!==input.creditDate||moneyCents(incoming.amount)!==moneyCents(input.creditAmount))
      throw new PlanningError("The transactions changed. Reopen the refund link.");
    if((await tx.query("SELECT id FROM refund_links WHERE credit_id=$1",[input.credit])).rows.length)
      throw new PlanningError("This credit already has a refund link. Reopen it to see the purchase.");
    const available=new Map((await choices(tx,s.workspace,input.purchase)).map(p=>[p.categoryId,moneyCents(p.remaining)]));
    let total=BigInt(0);
    const portions=input.portions.map(({categoryId,amount})=>{
      const cents=moneyCents(amount);
      if(cents>(available.get(categoryId)??BigInt(0))) throw new PlanningError("The refund exceeds the amount still available in that category.");
      available.delete(categoryId);
      total+=cents;
      return {categoryId,amount:decimalMoney(cents)};
    });
    if(total!==moneyCents(incoming.amount))throw new PlanningError("Assign the entire credit to its original categories.");
    await tx.query("INSERT INTO refund_links(id,workspace_id,actor_id,credit_id,purchase_id,portions) VALUES($1,$2,$3,$4,$5,$6::jsonb)",
      [crypto.randomUUID(),s.workspace,s.actor,input.credit,input.purchase,JSON.stringify(portions)]);
  });
}
export async function unlinkRefund(db:HouseholdDb,s:PlanningScope,credit:string,link:string){
  await db.transaction(async tx=>{
    await authorizePlanning(tx,s,true);
    const result=await tx.query("DELETE FROM refund_links WHERE workspace_id=$1 AND credit_id=$2 AND id=$3 RETURNING id",[s.workspace,id.parse(credit),id.parse(link)]);
    if(!result.rows.length)throw new PlanningError("The refund link changed. Reopen it to check.");
  });
}
