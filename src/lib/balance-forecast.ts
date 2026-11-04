import type {HouseholdDb} from "./household-db";
import {addDays,differenceInCalendarDays,format,parseISO} from "date-fns";
import {z} from "zod";
import {authorizePlanning,PlanningError,type PlanningScope} from "./monthly-planning";
import {advanceRecurringDate} from "./recurring-date";
import {moneyCents,decimalMoney} from "./statement-review";

import {accountCoverage,missingMonthlyBills} from "./forecast-coverage";
import {eligibleCash} from "./cash-eligibility";
import {scenarioName,scenarioForAccount,type ScenarioSetting} from "./forecast-scenario";

const options=z.object({account:z.string().min(1).max(128).nullable(),scenario:scenarioName.default("base"),includeExpectedPay:z.boolean().default(false),horizon:z.enum(["payday","30","60","90"])});
type Entry={id:string;account:string|null;date:string;amount:string;type:"income"|"expense";note:string;category:string|null};
type Schedule=Omit<Entry,"date">&{next:string;end:string|null;frequency:string;count:number;maximum:number|null;auto:boolean;commitment:string};
type Event={key:string;date:string;label:string;detail:string;href:string;source:"Ledger"|"Transfer"|"Card repayment"|"Installment"|"Expected pay"|"Schedule"|"Bill estimate"|"Spending estimate";cashChange:string;change:string;overlap?:boolean;matchedSchedule?:string};
type PayEstimate={account:string;name:string;first:string;next:string;date:string;expected:string;recorded:string;scheduled:string;remainder:string};
const ledgerHref=(id:string,date:string,type:string)=>"/?"+new URLSearchParams({tab:"transactions",range:"day",date,type,entry:id});
const scheduleHref=(id:string)=>"#schedule-"+encodeURIComponent(id);
const signed=(row:Pick<Entry,"amount"|"type">)=>row.type==="expense"?-moneyCents(row.amount):moneyCents(row.amount);
const matchKey=(row:Omit<Entry,"id">)=>JSON.stringify([row.account,row.date,row.type,decimalMoney(moneyCents(row.amount)),row.category,row.note.trim().toLowerCase()]);

function timeline(events:Event[],opening:bigint,cashOpening:bigint,daily:bigint,start:string,end:string){
  const days:{date:string;balance:string;events:Event[]}[]=[];
  let balance=opening,lowest=opening,lowDate=start,cash=cashOpening,lowestCash=cashOpening,cashLowDate=start;
  const grouped=new Map<string,Event[]>();
  for(const event of events){
    const list=grouped.get(event.date)??[];
    list.push(event);grouped.set(event.date,list);
  }
  function closeDay(date:string,rows:Event[],estimatedDays:number){
    if(estimatedDays&&daily>BigInt(0)){
      const change=decimalMoney(-daily*BigInt(estimatedDays));
      rows.push({key:"scenario-"+date,date,label:"Everyday spending",detail:estimatedDays===1?"One day":estimatedDays+" days through "+date,
        href:"#forecast-setting-list",source:"Spending estimate",cashChange:change,change});
    }
    for(const row of rows){balance+=moneyCents(row.change);cash+=moneyCents(row.cashChange);}
    if(balance<lowest){lowest=balance;lowDate=date;}
    if(cash<lowestCash){lowestCash=cash;cashLowDate=date;}
    days.push({date,balance:decimalMoney(balance),events:rows});
  }
  let previous=parseISO(start);
  for(const date of [...grouped.keys()].sort()){
    const current=parseISO(date),gap=differenceInCalendarDays(current,previous)-1;
    // A deposit can hide a low point the night before. Close that quiet span first.
    if(gap>0&&daily>BigInt(0))closeDay(format(addDays(current,-1),"yyyy-MM-dd"),[],gap);
    closeDay(date,grouped.get(date)!.sort((a,b)=>a.key.localeCompare(b.key)),1);
    previous=current;
  }
  const tail=differenceInCalendarDays(parseISO(end),previous);
  if(tail>0&&daily>BigInt(0))closeDay(end,[],tail);
  return {days,closing:decimalMoney(balance),lowest:decimalMoney(lowest),lowDate,lowestCash:decimalMoney(lowestCash),cashLowDate};
}

export async function forecastBalances(db:HouseholdDb,scope:PlanningScope,raw:unknown,now=new Date()){
  const {account,horizon,scenario,includeExpectedPay}=options.parse(raw);
  const start=format(now,"yyyy-MM-dd");
  return db.transaction(async tx=>{
    await authorizePlanning(tx,scope,false);
    const ws=scope.workspace;
    const accounts=(await tx.query<{id:string;name:string;type:string;initial:string;movement:string;opening:string;eligible:boolean;archived:boolean;lastActivity:string|null;statementEnd:string|null}>(`WITH movements AS (
      SELECT account_id AS account,max(date) AS last_date,sum(CASE WHEN type='income' THEN amount ELSE -amount END) AS delta
        FROM transactions WHERE workspace_id=$1 AND date<=$2 GROUP BY account_id
      UNION ALL
      SELECT leg.account,max(t.date),sum(leg.amount) FROM transfers t
        CROSS JOIN LATERAL (VALUES(t.from_account_id,-t.amount),(t.to_account_id,t.amount)) leg(account,amount)
        WHERE t.workspace_id=$1 AND t.date<=$2 GROUP BY leg.account
    ) SELECT a.id,a.name,a.type,a.archived,a.initial_balance::text AS initial,coalesce(sum(m.delta),0)::text AS movement,max(m.last_date)::text AS "lastActivity",
      (SELECT max(s.end_date)::text FROM reconciliation_sessions s WHERE s.workspace_id=$1 AND s.account_id=a.id
        AND s.status='completed' AND s.end_date<=$2) AS "statementEnd",${eligibleCash} AS eligible,(a.initial_balance+coalesce(sum(m.delta),0))::text AS opening
      FROM accounts a LEFT JOIN movements m ON m.account=a.id WHERE a.workspace_id=$1
      GROUP BY a.id ORDER BY a.name,a.id`,[ws,start])).rows;
    const names=new Map(accounts.map(a=>[a.id,a.name]));
    if(account&&!names.has(account))throw new PlanningError("Choose an account in this workspace.");
    const opening=accounts.filter(a=>!account||a.id===account).reduce((sum,a)=>sum+moneyCents(a.opening),BigInt(0));
    const cashAccounts=accounts.filter(a=>a.eligible&&(!account||a.id===account));
    const cashIds=new Set(cashAccounts.map(a=>a.id));
    const cashOpening=cashAccounts.reduce((sum,a)=>sum+moneyCents(a.opening),BigInt(0));
    const settings=(await tx.query<ScenarioSetting>("SELECT account_id AS account,scenario,daily::text,buffer::text,version FROM forecast_scenarios WHERE workspace_id=$1",[ws])).rows;
    const assumptions=cashAccounts.map(a=>scenarioForAccount(a.id,a.name,scenario,settings));
    const daily=assumptions.reduce((sum,s)=>sum+moneyCents(s.daily),BigInt(0));
    const buffer=assumptions.reduce((sum,s)=>sum+moneyCents(s.buffer),BigInt(0));
    const holds=(await tx.query<{account:string;goal:string;name:string;amount:string}>(`SELECT r.account_id AS account,r.goal_id AS goal,g.name,sum(r.delta)::text AS amount
      FROM goal_reservations r JOIN goals g ON g.id=r.goal_id AND g.workspace_id=r.workspace_id
      WHERE r.workspace_id=$1 GROUP BY r.account_id,r.goal_id,g.name HAVING sum(r.delta)<>0 ORDER BY g.name,r.goal_id,r.account_id`,[ws])).rows;
    const reserved=holds.reduce((sum,r)=>cashIds.has(r.account)?sum+moneyCents(r.amount):sum,BigInt(0));
    let end:string|null;
    let paydayPlan:{account:string;start:string;next:string;date:string}|null=null;
    if(horizon==="payday"){
      const payday=await tx.query<{account:string;start:string;next:string;date:string}>(`SELECT p.account_id AS account,p.start_date::text AS start,p.next_date::text AS next,d.day::text AS date FROM pay_period_plans p
        CROSS JOIN LATERAL (VALUES (p.start_date),(p.next_date)) d(day)
        WHERE p.workspace_id=$1 AND ($2::text IS NULL OR p.account_id=$2) AND d.day>$3
        ORDER BY d.day,p.account_id,p.start_date LIMIT 1`,[ws,account,start]);
      paydayPlan=payday.rows[0]??null;
      end=paydayPlan?.date??null;
    }else end=format(addDays(parseISO(start),Number(horizon)),"yyyy-MM-dd");
    const openingAccounts=accounts.filter(a=>!account||a.id===account).map(({id,name,eligible,initial,movement,opening})=>({id,name,eligible,initial,movement,opening}));
    const payEstimates:PayEstimate[]=[];
    const header={start,end,paydayPlan,payEstimates,assumptions,openingAccounts,reservations:holds.filter(r=>cashIds.has(r.account)),daily:decimalMoney(daily),buffer:decimalMoney(buffer),reserved:decimalMoney(reserved),calculatedAt:now.toISOString(),opening:decimalMoney(opening)};
    const freshness=accountCoverage(accounts,account,start);
    if(!end)return {...header,coverage:{...freshness,bills:[]},projection:null,warnings:["Set a future payday in Planning for the selected accounts."]};
    const args=[ws,start,end,account];
    const ledger=(await tx.query<Entry>(`SELECT id,account_id AS account,category_id AS category,date::text,amount::text,type,note
      FROM transactions WHERE workspace_id=$1 AND date>$2 AND date<=$3::date+3 AND ($4::text IS NULL OR account_id=$4) ORDER BY date,id`,args)).rows;
    const transfers=(await tx.query<{id:string;date:string;amount:string;fromId:string;toId:string;note:string}>(`SELECT id,date::text,amount::text,from_account_id AS "fromId",to_account_id AS "toId",note
      FROM transfers WHERE workspace_id=$1 AND date>$2 AND date<=$3 AND ($4::text IS NULL OR from_account_id=$4 OR to_account_id=$4)`,args)).rows;
    const schedules=(await tx.query<Schedule>(`SELECT id,account_id AS account,category_id AS category,type,amount::text,note,
      next_date::text AS next,end_date::text AS end,frequency,occurrence_count AS count,max_occurrences AS maximum,auto_post AS auto,commitment_type AS commitment
      FROM recurring WHERE workspace_id=$1 AND next_date<=$2 AND (end_date IS NULL OR end_date>=$3)
      AND (max_occurrences IS NULL OR occurrence_count<max_occurrences) AND ($4::text IS NULL OR account_id=$4) ORDER BY id`,[ws,end,start,account])).rows;
    const events:Event[]=[],warnings=new Set<string>();
    const matches=new Map<string,Event[]>();
    const cards=new Set(accounts.filter(a=>a.type==="card").map(a=>a.id));
    const amountKey=(id:string,date:string,amount:string)=>JSON.stringify([id,date,decimalMoney(moneyCents(amount))]);
    const repaymentCandidates=new Map<string,{event:Event;note:string}[]>();
    const recordedExpenses=new Set<string>();
    const recordedIncome=new Set<string>();
    const scheduledIncome:{account:string;date:string;amount:string}[]=[];
    for(const t of ledger){
      if(t.date>end)continue;
      if(!t.account||!names.has(t.account)){warnings.add("Future entries without a tracked account are excluded.");continue;}
      const event:Event={key:"entry-"+t.id,date:t.date,label:t.note||t.type,detail:names.get(t.account)!,href:ledgerHref(t.id,t.date,t.type),source:"Ledger",cashChange:cashIds.has(t.account)?decimalMoney(signed(t)):"0.00",change:decimalMoney(signed(t))};
      events.push(event);
      (t.type==="expense"?recordedExpenses:recordedIncome).add(amountKey(t.account,t.date,t.amount));
      const key=matchKey(t),candidates=matches.get(key)??[];
      candidates.push(event);matches.set(key,candidates);
    }
    for(const t of transfers){
      const amount=moneyCents(t.amount);
      const change=(!account||account===t.toId?amount:BigInt(0))-(!account||account===t.fromId?amount:BigInt(0));
      const repayment=cards.has(t.toId)&&!cards.has(t.fromId);
      const event:Event={key:"transfer-"+t.id,date:t.date,label:t.note||(repayment?"Card repayment":"Transfer"),href:ledgerHref(t.id,t.date,"transfer"),
        detail:(names.get(t.fromId)??"Unknown account")+" → "+(names.get(t.toId)??"Unknown account"),source:repayment?"Card repayment":"Transfer",cashChange:decimalMoney((cashIds.has(t.toId)?amount:BigInt(0))-(cashIds.has(t.fromId)?amount:BigInt(0))),change:decimalMoney(change)};
      events.push(event);
      if(repayment){
        const key=amountKey(t.fromId,t.date,t.amount);
        const candidates=repaymentCandidates.get(key)??[];
        candidates.push({event,note:t.note.trim().toLowerCase()});repaymentCandidates.set(key,candidates);
      }
    }
    for(const r of schedules){
      if(!r.account||!names.has(r.account)){warnings.add("Schedules without a tracked account are excluded.");continue;}
      let date=r.next,count=r.count;
      while(date<=end&&(!r.end||date<=r.end)&&(r.maximum===null||count<r.maximum)){
        if(date<=start){warnings.add("Due occurrences still on a schedule are excluded from the opening balance until recorded.");}
        else{
          const installment=r.commitment==="emi"&&r.type==="expense";
          const key=amountKey(r.account,date,r.amount);
          const candidates=installment?repaymentCandidates.get(key):undefined;
          const named=candidates?.find(c=>!c.event.matchedSchedule&&c.note!==""&&c.note===r.note.trim().toLowerCase())?.event;
          const ledgerMatch=matches.get(matchKey({...r,date}))?.shift();
          const match=ledgerMatch??named;
          if(ledgerMatch&&named)warnings.add("An installment matches both a ledger expense and a card transfer. Review both recorded entries. The schedule adds no extra charge.");
          if(!match&&scenario==="base"&&r.type==="income"&&recordedIncome.has(key))warnings.add("Scheduled income and a dated deposit share an account, date and amount but lack an unused exact match. Base includes both. Review them before relying on the estimate.");
          if(!match&&candidates?.length)warnings.add("A card transfer and installment share an account, date and amount. Check their notes before treating them as the same payment.");
          if(!match&&installment&&recordedExpenses.has(key))warnings.add("An installment and a recorded expense share an account, date and amount but lack an unused exact match. Review the entries.");
          if(named&&!ledgerMatch&&r.auto)warnings.add("A card transfer covers an automatic installment in this forecast. Review the posting schedule before the due date to avoid recording a second payment.");
          if(match){match.overlap=true;match.matchedSchedule=scheduleHref(r.id);}
          else if(scenario==="conservative"&&r.type==="income")warnings.add("Conservative excludes scheduled income without a matching dated ledger entry.");
          else{
            events.push({key:"rule-"+r.id+"-"+date,date,label:r.note||"Recurring "+r.type,href:scheduleHref(r.id),
              detail:names.get(r.account)!+(installment&&!r.auto?" · Estimated installment":""),source:installment?"Installment":r.auto?"Schedule":"Bill estimate",cashChange:cashIds.has(r.account)?decimalMoney(signed(r)):"0.00",change:decimalMoney(signed(r))});
            if(r.type==="income")scheduledIncome.push({account:r.account,date,amount:r.amount});
          }
        }
        count++;date=advanceRecurringDate(date,r.frequency);
      }
    }
    if(includeExpectedPay&&scenario==="base"){
      const periods=await tx.query<Omit<PayEstimate,"name"|"scheduled"|"remainder">>(`SELECT p.account_id AS account,
        p.start_date::text AS first,p.next_date::text AS next,(p.next_date-1)::text AS date,p.expected::text,
        coalesce((SELECT sum(t.amount) FROM transactions t WHERE t.workspace_id=p.workspace_id AND t.account_id=p.account_id
          AND t.type='income' AND t.date>=p.start_date AND t.date<p.next_date AND NOT EXISTS
          (SELECT 1 FROM refund_links r WHERE r.workspace_id=t.workspace_id AND r.credit_id=t.id)),0.00)::text AS recorded
        FROM pay_period_plans p JOIN accounts a ON a.workspace_id=p.workspace_id AND a.id=p.account_id
        WHERE p.workspace_id=$1 AND ${eligibleCash} AND p.expected>0 AND (p.next_date-1)>$2 AND (p.next_date-1)<=$3
        AND ($4::text IS NULL OR p.account_id=$4) ORDER BY p.next_date,p.account_id`,args);
      for(const plan of periods.rows){
        const scheduled=scheduledIncome.filter(s=>s.account===plan.account&&s.date>=plan.first&&s.date<plan.next)
          .reduce((sum,s)=>sum+moneyCents(s.amount),BigInt(0));
        const gap=moneyCents(plan.expected)-moneyCents(plan.recorded)-scheduled;
        const remainder=decimalMoney(gap>BigInt(0)?gap:BigInt(0));
        const name=names.get(plan.account)??"Account";
        payEstimates.push({...plan,name,scheduled:decimalMoney(scheduled),remainder});
        if(gap>BigInt(0))events.push({key:"pay-"+plan.account+"-"+plan.first,date:plan.date,label:"Remaining expected income",
          detail:name+" · End of planned period",href:"#pay-estimate-"+encodeURIComponent(plan.account)+"-"+plan.first,source:"Expected pay",change:remainder,cashChange:cashIds.has(plan.account)?remainder:"0.00"});
      }
    }
    if(!accounts.length)warnings.add("Add an account to start forecasting balances.");
    const projection=timeline(events,opening,cashOpening,daily,start,end);
    const complete=assumptions.length>0&&assumptions.every(a=>a.configured);
    const bills=await missingMonthlyBills(tx,ws,account,start,end,ledger.filter(t=>t.type==="expense"));
    return {...header,coverage:{...freshness,bills},projection:{...projection,spendable:complete?decimalMoney(moneyCents(projection.lowestCash)-reserved-buffer):null},warnings:[...warnings]};
  });
}
