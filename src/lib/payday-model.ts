import {decimalMoney,moneyCents} from "./statement-review";

export type Cadence="weekly"|"biweekly"|"irregular";
export function nextAnnualDue(due:string){
  const [year,month,day]=due.split("-").map(Number);
  const finalDay=new Date(Date.UTC(year+1,month,0)).getUTCDate();
  return new Date(Date.UTC(year+1,month-1,Math.min(day,finalDay))).toISOString().slice(0,10);
}
export function nextPayday(start:string,cadence:Cadence){
  if(cadence==="irregular"||!/^\d{4}-\d{2}-\d{2}$/.test(start))return "";
  const d=new Date(start+"T00:00:00Z");
  if(!Number.isFinite(d.getTime()))return "";
  d.setUTCDate(d.getUTCDate()+(cadence==="weekly"?7:14));
  return d.toISOString().slice(0,10);
}
export function annualFunding(target:string,reserved:string,due:string,today:string){
  const difference=moneyCents(target)-moneyCents(reserved);
  const gap=difference>0?difference:BigInt(0);
  const monthIndex=(s:string)=>Number(s.slice(0,4))*12+Number(s.slice(5,7));
  const months=due<today?0:monthIndex(due)-monthIndex(today)+1;
  return {gap:decimalMoney(gap),months,monthly:months?decimalMoney((gap+BigInt(months-1))/BigInt(months)):null};
}
