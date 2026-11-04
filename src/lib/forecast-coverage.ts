import type {HouseholdReader} from "./household-db";
import {addDays,addMonths,differenceInCalendarDays,endOfMonth,format,getDate,parseISO,startOfMonth,subMonths} from "date-fns";
import {normalizeMerchant} from "./merchant-rule-model";
import {moneyCents} from "./statement-review";

type AccountEvidence={id:string;name:string;archived:boolean;lastActivity:string|null;statementEnd:string|null};
type Expense={account:string|null;date:string;note:string;amount:string};
type Bill={account:string;accountName:string;label:string;expected:string;history:{date:string;amount:string}[]};
const day=(date:Date)=>format(date,"yyyy-MM-dd");
const keyFor=(account:string,note:string)=>JSON.stringify([account,normalizeMerchant(note)]);
const monthNumber=(date:Date)=>date.getFullYear()*12+date.getMonth();

export function accountCoverage(accounts:AccountEvidence[],selection:string|null,start:string){
  const cutoff=day(addDays(parseISO(start),-30));
  const active=accounts.filter(a=>!a.archived&&(!selection||a.id===selection));
  const gaps=active.flatMap(a=>{
    const latest=[a.lastActivity,a.statementEnd].filter((v):v is string=>v!==null).sort().at(-1);
    return latest&&latest>=cutoff?[]:[{id:a.id,name:a.name,lastActivity:a.lastActivity,statementEnd:a.statementEnd}];
  });
  return {accountCount:active.length,accounts:gaps};
}

function expectedDay(month:Date,anchor:number){
  return new Date(month.getFullYear(),month.getMonth(),Math.min(anchor,getDate(endOfMonth(month))));
}

// History is ordered by date. Use only one named expense per month for three
// consecutive months, so several visits to the same shop are not a monthly bill.
export async function missingMonthlyBills(tx:HouseholdReader,workspace:string,account:string|null,start:string,end:string,
  future:Expense[]):Promise<Bill[]>{
  const today=parseISO(start);
  const history=(await tx.query<Expense&{account:string;accountName:string}>(`SELECT t.account_id AS account,a.name AS "accountName",
    t.date::text,t.note,t.amount::text FROM transactions t JOIN accounts a ON a.id=t.account_id AND a.workspace_id=t.workspace_id
    WHERE t.workspace_id=$1 AND NOT a.archived AND t.type='expense' AND t.amount>0 AND btrim(t.note)<>''
    AND t.date BETWEEN $2 AND $3 AND ($4::text IS NULL OR a.id=$4) ORDER BY t.date,t.id`,
    [workspace,day(startOfMonth(subMonths(today,4))),start,account])).rows;
  if(!history.length)return [];
  // An explicitly managed bill, including a stopped subscription, has its own schedule.
  const rules=await tx.query<{account:string;note:string}>(`SELECT account_id AS account,note FROM recurring WHERE workspace_id=$1
    AND type='expense' AND account_id IS NOT NULL AND ($2::text IS NULL OR account_id=$2)`,[workspace,account]);
  const managed=new Set(rules.rows.map(r=>keyFor(r.account,r.note)));
  const recorded=new Map<string,Date[]>();
  for(const entry of future){
    if(!entry.account)continue;
    const key=keyFor(entry.account,entry.note);
    const dates=recorded.get(key)??[];
    dates.push(parseISO(entry.date));recorded.set(key,dates);
  }
  const groups=new Map<string,typeof history>();
  for(const entry of history){
    if(normalizeMerchant(entry.note).length<2)continue;
    const key=keyFor(entry.account,entry.note);
    if(managed.has(key))continue;
    const rows=groups.get(key)??[];rows.push(entry);groups.set(key,rows);
  }
  const bills:Bill[]=[];
  for(const [key,rows] of groups){
    if(rows.length<3)continue;
    const recent=rows.slice(-3),dates=recent.map(r=>parseISO(r.date)),months=dates.map(monthNumber);
    if(months[1]!==months[0]+1||months[2]!==months[1]+1||rows.at(-4)?.date.slice(0,7)===recent[0].date.slice(0,7))continue;
    const amounts=recent.map(r=>moneyCents(r.amount)).sort((a,b)=>a<b?-1:a>b?1:0);
    if(amounts[2]*BigInt(4)>amounts[0]*BigInt(5))continue;
    const anchor=dates.every(d=>differenceInCalendarDays(endOfMonth(d),d)<=2)?31:dates.map(d=>getDate(d)).sort((a,b)=>a-b)[1];
    if(dates.some(d=>Math.abs(differenceInCalendarDays(d,expectedDay(d,anchor)))>3))continue;
    const last=recent[2];
    let month=addMonths(startOfMonth(dates[2]),1),due=expectedDay(month,anchor);
    if(differenceInCalendarDays(today,due)>14)continue;
    while(day(due)<=end){
      if(!(recorded.get(key)??[]).some(d=>Math.abs(differenceInCalendarDays(d,due))<=3)){
        bills.push({account:last.account,accountName:last.accountName,label:last.note,expected:day(due),
          history:recent.map(({date,amount})=>({date,amount}))});
        break;
      }
      month=addMonths(month,1);due=expectedDay(month,anchor);
    }
  }
  return bills.sort((a,b)=>a.expected.localeCompare(b.expected)||a.label.localeCompare(b.label)||a.account.localeCompare(b.account));
}
