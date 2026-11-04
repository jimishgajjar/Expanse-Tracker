import type {HouseholdDb, HouseholdReader} from "./household-db";
import {eligibleCash} from "./cash-eligibility";
import {z} from "zod";
import {moneyCents,decimalMoney,statementAmount,statementDate} from "./statement-review";
import {annualFunding,nextPayday,type Cadence} from "./payday-model";
import {todayISO} from "./dates";

import {goalProgressSelect,type GoalProgress} from "./goal-progress";
import {netBudgetExpenses} from "./net-budget-expenses";

export type PlanningScope={workspace:string;actor:string};
const monthInput=z.string().regex(/^(19|20)\d\d-(0[1-9]|1[0-2])$/);
const amountInput=statementAmount.refine(s=>moneyCents(s)>=BigInt(0));
const ref=z.string().min(1).max(128);
const planInput=z.object({category:ref,month:monthInput,amount:amountInput,rollover:z.boolean(),version:z.number().int().nonnegative()});
const reserveInput=z.object({id:z.uuid(),account:ref,goal:ref,amount:amountInput.refine(s=>moneyCents(s)>BigInt(0)),release:z.boolean()});
export class PlanningError extends Error {}
export async function authorizePlanning(tx:HouseholdReader,s:PlanningScope,write:boolean){
  const member=await tx.query<{role:string}>("SELECT role FROM workspace_members WHERE workspace_id=$1 AND user_id=$2 AND role IN ('owner','member','viewer') FOR SHARE",[s.workspace,s.actor]);
  if(!member.rows.length||write&&!["owner","member"].includes(member.rows[0].role))throw new PlanningError("Access to this workspace is required.");
}
type Plan={category:string;month:string;amount:string;rollover:boolean;version:number};
type Spending={category:string;month:string;amount:string};
export function budgetPeriod(month:string,plans:Plan[],spending:Spending[],moves:Spending[]=[]){
  const adjustments=new Map(moves.map(r=>[r.category+":"+r.month,moneyCents(r.amount)]));
  const amounts=new Map(spending.map(r=>[r.category+":"+r.month,moneyCents(r.amount)]));
  const grouped=new Map<string,Plan[]>();
  for(const plan of plans){const list=grouped.get(plan.category)??[];list.push(plan);grouped.set(plan.category,list);}
  const result=[];
  for(const [category,list] of grouped){
    list.sort((a,b)=>a.month.localeCompare(b.month));
    const changes=new Map(list.map(r=>[r.month,r]));
    let carry=BigInt(0),active=list[0];
    for(let period=active.month;period<=month;){
      active=changes.get(period)??active;
      const spent=amounts.get(category+":"+period)??BigInt(0);
      const moved=adjustments.get(category+":"+period)??BigInt(0);
      const remaining=carry+moneyCents(active.amount)+moved-spent;
      if(period===month)result.push({category,base:active.amount,moved:decimalMoney(moved),carry:decimalMoney(carry),spent:decimalMoney(spent),
        remaining:decimalMoney(remaining),rollover:active.rollover,effective:active.month,version:changes.get(period)?.version??0});
      carry=active.rollover?remaining:BigInt(0);
      const [y,m]=period.split("-").map(Number);
      period=m===12?(y+1)+"-01":y+"-"+String(m+1).padStart(2,"0");
    }
  }
  return result;
}
async function funding(tx:HouseholdReader,ws:string,day:string){
  return (await tx.query<{id:string;name:string;eligible:boolean;balance:string;reserved:string;free:string}>(`WITH cash AS (
    SELECT a.id,a.name,${eligibleCash} AS eligible,
      a.initial_balance+coalesce((SELECT sum(CASE WHEN t.type='income' THEN t.amount ELSE -t.amount END)
        FROM transactions t WHERE t.workspace_id=$1 AND t.account_id=a.id AND t.date<=$2),0)
      +coalesce((SELECT sum(amount) FROM transfers WHERE workspace_id=$1 AND to_account_id=a.id AND date<=$2),0)
      -coalesce((SELECT sum(amount) FROM transfers WHERE workspace_id=$1 AND from_account_id=a.id AND date<=$2),0) AS balance,
      coalesce((SELECT sum(delta) FROM goal_reservations WHERE workspace_id=$1 AND account_id=a.id),0.00) AS reserved
    FROM accounts a WHERE a.workspace_id=$1)
    SELECT id,name,eligible,balance::text,reserved::text,(balance-reserved)::text AS free FROM cash
    WHERE eligible OR reserved>0 ORDER BY name,id`,[ws,day])).rows;
}
export async function readPeriods(tx:HouseholdReader,workspace:string,month:string,day:string){
    const plans=(await tx.query<Plan>(`SELECT category_id AS category,to_char(month,'YYYY-MM') AS month,amount::text,rollover,version
      FROM monthly_plans WHERE workspace_id=$1 AND month<=$2 ORDER BY month,category_id`,[workspace,month+"-01"])).rows;
    const spent=plans.length?(await tx.query<Spending>(`SELECT t.category_id AS category,to_char(t.date,'YYYY-MM') AS month,
      sum(t.amount)::text AS amount FROM ${netBudgetExpenses} t
      WHERE t.workspace_id=$1 AND t.type='expense' AND t.date >=$2 AND t.date < $3::date+interval '1 month' AND t.date<=$4
      GROUP BY 1,2`,[workspace,plans[0].month+"-01",month+"-01",day])).rows:[];
    const moves=(await tx.query<Spending>(`SELECT leg.category,to_char(m.month,'YYYY-MM') AS month,sum(leg.delta)::text AS amount
      FROM budget_moves m CROSS JOIN LATERAL (VALUES(m.from_category,-m.amount),(m.to_category,m.amount)) AS leg(category,delta)
      WHERE m.workspace_id=$1 AND m.month<=$2 GROUP BY leg.category,m.month`,[workspace,month+"-01"])).rows;
    return budgetPeriod(month,plans,spent,moves);
}

const moveInput=z.object({id:z.uuid(),month:monthInput,source:ref,destination:ref,
  amount:amountInput.refine(a=>moneyCents(a)>BigInt(0)),note:z.string().trim().max(200).default("")});

export async function moveBudget(db:HouseholdDb,s:PlanningScope,raw:unknown,day=todayISO()){
  const move=moveInput.parse(raw);
  if(move.source===move.destination)throw new PlanningError("Choose two different categories.");
  await db.transaction(async tx=>{
    await authorizePlanning(tx,s,true);
    await tx.query("SELECT id FROM workspaces WHERE id=$1 FOR UPDATE",[s.workspace]);
    const date=move.month+"-01";
    const params=[move.id,s.workspace,date,move.source,move.destination,move.amount,move.note,s.actor];
    const prior=await tx.query<{matches:boolean}>(`SELECT (workspace_id=$2 AND month=$3 AND from_category=$4 AND to_category=$5
      AND amount=$6 AND note=$7 AND actor_id=$8) AS matches FROM budget_moves WHERE id=$1`,params);
    if(prior.rows.length){
      if(!prior.rows[0].matches)throw new PlanningError("This request has already been used. Refresh the monthly plan.");
      return;
    }
    const periods=await readPeriods(tx,s.workspace,move.month,day);
    const source=periods.find(p=>p.category===move.source);
    if(!source||!periods.some(p=>p.category===move.destination))
      throw new PlanningError("Both categories need an allocation in the selected month.");
    if(moneyCents(source.remaining)<moneyCents(move.amount))
      throw new PlanningError("The source category has less than that amount remaining. Refresh the monthly plan.");
    await tx.query(`INSERT INTO budget_moves(id,workspace_id,month,from_category,to_category,amount,note,actor_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,params);
  });
}

export async function planningMonth(db:HouseholdDb,s:PlanningScope,month:string,day=todayISO()){
  monthInput.parse(month);
  return db.transaction(async tx=>{
    await authorizePlanning(tx,s,false);
    const periods=await readPeriods(tx,s.workspace,month,day);
    const moves=(await tx.query<{id:string;source:string;destination:string;amount:string;note:string;actor:string;created:string}>(`SELECT m.id,m.from_category AS source,m.to_category AS destination,m.amount::text,m.note,
      coalesce(nullif(u.name,''),u.email,'Former member') AS actor,to_char(m.created_at,'YYYY-MM-DD HH24:MI') AS created
      FROM budget_moves m LEFT JOIN users u ON u.id=m.actor_id WHERE m.workspace_id=$1 AND m.month=$2
      ORDER BY m.created_at DESC,m.id DESC`,[s.workspace,month+"-01"])).rows;
    const held=(await tx.query<{account:string;goal:string;amount:string}>(`SELECT account_id AS account,goal_id AS goal,sum(delta)::text AS amount
      FROM goal_reservations WHERE workspace_id=$1 GROUP BY account_id,goal_id HAVING sum(delta)>0`,[s.workspace])).rows;
    const paydays=(await tx.query<{account:string;start:string;next:string;cadence:Cadence;expected:string;limit:string;version:number;income:string;spent:string}>(`SELECT p.account_id AS account,p.start_date::text AS start,p.next_date::text AS next,p.cadence,p.expected::text,p.spending_limit::text AS limit,p.version,
      coalesce(sum(t.amount) FILTER(WHERE t.type='income' AND r.id IS NULL),0.00)::text AS income,
      (coalesce(sum(t.amount) FILTER(WHERE t.type='expense'),0.00)-coalesce(sum(t.amount) FILTER(WHERE r.id IS NOT NULL),0.00))::text AS spent
      FROM pay_period_plans p LEFT JOIN transactions t ON t.workspace_id=p.workspace_id AND t.account_id=p.account_id
      AND t.date>=p.start_date AND t.date<p.next_date AND t.date<=$3
      LEFT JOIN refund_links r ON r.workspace_id=p.workspace_id AND r.credit_id=t.id
      WHERE p.workspace_id=$1 AND p.start_date<$2::date+interval '1 month' AND p.next_date>$2::date
      GROUP BY p.workspace_id,p.account_id,p.start_date ORDER BY p.start_date,p.account_id`,[s.workspace,month+"-01",day])).rows;
    const progress=(await tx.query<GoalProgress>(`SELECT id,name,opening,reserved,outside,confirmed,reviewed,version
      FROM (${goalProgressSelect} WHERE g.workspace_id=$1) p ORDER BY name,id`,[s.workspace])).rows;
    const funds=(await tx.query<{goal:string;due:string;version:number;target:string}>(`SELECT a.goal_id AS goal,a.due::text AS due,a.version,g.target_amount::text AS target
      FROM annual_goal_plans a JOIN goals g ON g.workspace_id=a.workspace_id AND g.id=a.goal_id
      WHERE a.workspace_id=$1 ORDER BY a.due,a.goal_id`,[s.workspace])).rows;
    const byGoal=new Map(progress.map(p=>[p.id,p]));
    const annual=funds.map(f=>{
      const p=byGoal.get(f.goal)!;
      return {...f,reserved:p.reserved,outside:p.outside,...annualFunding(f.target,p.confirmed,f.due,day)};
    });
    return {periods,moves,progress,annual,accounts:await funding(tx,s.workspace,day),held,day,
      paydays:paydays.map(p=>({...p,remaining:decimalMoney(moneyCents(p.limit)-moneyCents(p.spent))}))};
  });
}

const planDate=statementDate.refine(s=>s>="1900-01-01"&&s<="2099-12-31");
const version=z.number().int().nonnegative();
const paydayInput=z.object({account:ref,start:planDate,next:planDate,cadence:z.enum(["weekly","biweekly","irregular"]),
  expected:amountInput,limit:amountInput,version}).refine(p=>p.start<p.next&&(p.cadence==="irregular"||nextPayday(p.start,p.cadence)===p.next));
export async function savePayday(db:HouseholdDb,s:PlanningScope,raw:unknown){
  const p=paydayInput.parse(raw);
  await db.transaction(async tx=>{
    await authorizePlanning(tx,s,true);
    if(!(await tx.query("SELECT id FROM accounts WHERE workspace_id=$1 AND id=$2 AND NOT archived AND type IN ('bank','cash','wallet','savings')",[s.workspace,p.account])).rows.length)
      throw new PlanningError("Choose an active cash account from this workspace.");
    if((await tx.query("SELECT 1 FROM pay_period_plans WHERE workspace_id=$1 AND account_id=$2 AND start_date<>$3 AND start_date<$4 AND next_date>$3",[s.workspace,p.account,p.start,p.next])).rows.length)
      throw new PlanningError("This account already has a budget covering part of that pay period.");
    const args=[s.workspace,p.account,p.start,p.next,p.cadence,p.expected,p.limit,p.version];
    const changed=await tx.query(p.version===0?`INSERT INTO pay_period_plans(workspace_id,account_id,start_date,next_date,cadence,expected,spending_limit,version)
      SELECT $1,$2,$3,$4,$5,$6,$7,1 WHERE $8::int=0 ON CONFLICT DO NOTHING RETURNING version`:`UPDATE pay_period_plans SET next_date=$4,cadence=$5,expected=$6,spending_limit=$7,version=version+1
      WHERE workspace_id=$1 AND account_id=$2 AND start_date=$3 AND version=$8 RETURNING version`,args);
    if(!changed.rows.length)throw new PlanningError("This pay period changed. Reload before editing.");
  });
}
export async function saveAnnualFund(db:HouseholdDb,s:PlanningScope,raw:unknown){
  const p=z.object({goal:ref,due:planDate,version}).parse(raw);
  await db.transaction(async tx=>{
    await authorizePlanning(tx,s,true);
    const args=[s.workspace,p.goal,p.due,p.version];
    const changed=await tx.query(p.version===0?`INSERT INTO annual_goal_plans(workspace_id,goal_id,due,version)
      SELECT $1,id,$3,1 FROM goals WHERE workspace_id=$1 AND id=$2 AND $4::int=0 ON CONFLICT DO NOTHING RETURNING version`:`UPDATE annual_goal_plans SET due=$3,version=version+1
      WHERE workspace_id=$1 AND goal_id=$2 AND version=$4 RETURNING version`,args);
    if(!changed.rows.length)throw new PlanningError("This goal or its due date changed. Reload before editing.");
  });
}
export async function removeSchedule(db:HouseholdDb,s:PlanningScope,raw:unknown){
  const p=z.discriminatedUnion("kind",[z.object({kind:z.literal("annual"),goal:ref,version}),
    z.object({kind:z.literal("pay"),account:ref,start:planDate,version})]).parse(raw);
  await db.transaction(async tx=>{
    await authorizePlanning(tx,s,true);
    const r=p.kind==="annual"?await tx.query("DELETE FROM annual_goal_plans WHERE workspace_id=$1 AND goal_id=$2 AND version=$3 RETURNING version",[s.workspace,p.goal,p.version]):
      await tx.query("DELETE FROM pay_period_plans WHERE workspace_id=$1 AND account_id=$2 AND start_date=$3 AND version=$4 RETURNING version",[s.workspace,p.account,p.start,p.version]);
    if(!r.rows.length)throw new PlanningError("This plan changed. Reload before removing it.");
  });
}
export async function savePlan(db:HouseholdDb,s:PlanningScope,raw:unknown){
  const p=planInput.parse(raw);
  await db.transaction(async tx=>{
    await authorizePlanning(tx,s,true);
    const params=[s.workspace,p.category,p.month+"-01",p.amount,p.rollover,p.version];
    const result=await tx.query(p.version===0?`INSERT INTO monthly_plans(workspace_id,category_id,month,amount,rollover,version)
      SELECT $1,id,$3,$4,$5,1 FROM categories WHERE workspace_id=$1 AND id=$2 AND kind='expense' AND $6::int=0
      ON CONFLICT DO NOTHING RETURNING version`:`UPDATE monthly_plans SET amount=$4,rollover=$5,version=version+1
      WHERE workspace_id=$1 AND category_id=$2 AND month=$3 AND version=$6 RETURNING version`,params);
    if(!result.rows.length)throw new PlanningError("The plan or category changed. Reload this month and try again.");
  });
}
export async function reserveCash(db:HouseholdDb,s:PlanningScope,raw:unknown,day=todayISO()){
  const p=reserveInput.parse(raw),amount=moneyCents(p.amount),delta=decimalMoney(p.release?-amount:amount);
  return db.transaction(async tx=>{
    await authorizePlanning(tx,s,true);
    const prior=(await tx.query<{account_id:string;goal_id:string;delta:string;actor_id:string}>("SELECT account_id,goal_id,delta::text,actor_id FROM goal_reservations WHERE workspace_id=$1 AND id=$2",[s.workspace,p.id])).rows[0];
    if(prior){
      if(prior.actor_id!==s.actor||prior.account_id!==p.account||prior.goal_id!==p.goal||moneyCents(prior.delta)!==moneyCents(delta))
        throw new PlanningError("This request was already used. Refresh to check the saved allocation.");
      return;
    }
    const account=(await funding(tx,s.workspace,day)).find(a=>a.id===p.account);
    if(!account||!(await tx.query("SELECT id FROM goals WHERE workspace_id=$1 AND id=$2",[s.workspace,p.goal])).rows.length)
      throw new PlanningError("Choose a goal and account from this workspace.");
    if(p.release){
      const held=await tx.query<{total:string}>("SELECT coalesce(sum(delta),0)::text AS total FROM goal_reservations WHERE workspace_id=$1 AND goal_id=$2 AND account_id=$3",[s.workspace,p.goal,p.account]);
      if(amount>moneyCents(held.rows[0].total))throw new PlanningError("This goal holds less than that amount in this account.");
    }else if(!account.eligible||amount>moneyCents(account.free))throw new PlanningError("This account does not have enough unreserved cash.");
    await tx.query("INSERT INTO goal_reservations(id,workspace_id,actor_id,goal_id,account_id,delta) VALUES($1,$2,$3,$4,$5,$6)",[p.id,s.workspace,s.actor,p.goal,p.account,delta]);
  });
}

const openingReviewInput=z.object({
  id:z.uuid(),goal:ref,version:z.number().int().nonnegative(),opening:amountInput,
  reserved:z.string().regex(/^\d+(\.\d{1,2})?$/),outside:amountInput,
});
export async function reviewGoalOpening(db:HouseholdDb,s:PlanningScope,raw:unknown){
  const r=openingReviewInput.parse(raw);
  if(moneyCents(r.opening)<=BigInt(0)||moneyCents(r.outside)>moneyCents(r.opening))
    throw new PlanningError("Enter the part held separately, from zero up to the original manual amount.");
  await db.transaction(async tx=>{
    await authorizePlanning(tx,s,true);
    const params=[r.id,s.workspace,r.goal,r.version+1,s.actor,r.opening,r.reserved,r.outside];
    const prior=(await tx.query<{same:boolean}>(`SELECT workspace_id=$2 AND goal_id=$3 AND version=$4 AND actor_id=$5
      AND opening=$6 AND reserved=$7 AND outside=$8 AS same FROM goal_opening_reviews WHERE id=$1`,params)).rows[0];
    if(prior?.same)return;
    if(prior)throw new PlanningError("This review request has already been used.");
    const goal=(await tx.query<GoalProgress>(`${goalProgressSelect} WHERE g.workspace_id=$1 AND g.id=$2 FOR UPDATE OF g`,[s.workspace,r.goal])).rows[0];
    if(!goal||goal.version!==r.version||moneyCents(goal.opening)!==moneyCents(r.opening)||moneyCents(goal.reserved)!==moneyCents(r.reserved))
      throw new PlanningError("Goal progress changed. Reload and review the amounts again.");
    await tx.query(`INSERT INTO goal_opening_reviews(id,workspace_id,goal_id,version,actor_id,opening,reserved,outside)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,params);
  });
}
