import type {HouseholdDb} from "./household-db";
import {eligibleCash} from "./cash-eligibility";
import {z} from "zod";
import {statementAmount,moneyCents,decimalMoney} from "./statement-review";
import {authorizePlanning,PlanningError,type PlanningScope} from "./monthly-planning";

export const scenarioName=z.enum(["base","conservative"]);
export type ScenarioName=z.infer<typeof scenarioName>;
type Setting={account:string;scenario:ScenarioName;daily:string;buffer:string;version:number};
const nonnegative=statementAmount.refine(value=>moneyCents(value)>=BigInt(0));
const input=z.object({account:z.string().min(1).max(128),scenario:scenarioName,daily:nonnegative,buffer:nonnegative,version:z.number().int().nonnegative()});

export function scenarioForAccount(id:string,name:string,scenario:ScenarioName,settings:Setting[]){
  const base=settings.find(s=>s.account===id&&s.scenario==="base");
  const chosen=settings.find(s=>s.account===id&&s.scenario===scenario);
  function effective(field:"daily"|"buffer"){
    const floor=moneyCents(base?.[field]??"0"),value=moneyCents(chosen?.[field]??"0");
    return decimalMoney(value>floor?value:floor);
  }
  return {id,name,version:chosen?.version??0,configured:!!(base||chosen),daily:effective("daily"),buffer:effective("buffer"),
    minimumDaily:scenario==="base"?"0.00":base?.daily??"0.00",minimumBuffer:scenario==="base"?"0.00":base?.buffer??"0.00"};
}
export async function saveForecastScenario(db:HouseholdDb,s:PlanningScope,raw:unknown){
  const p=input.parse(raw);
  await db.transaction(async tx=>{
    await authorizePlanning(tx,s,true);
    const account=await tx.query("SELECT id FROM accounts a WHERE a.workspace_id=$1 AND a.id=$2 AND "+eligibleCash+" FOR UPDATE",[s.workspace,p.account]);
    if(!account.rows.length)throw new PlanningError("Choose an active cash account from this workspace.");
    const settings=(await tx.query<Setting>("SELECT account_id AS account,scenario,daily::text,buffer::text,version FROM forecast_scenarios WHERE workspace_id=$1 AND account_id=$2",[s.workspace,p.account])).rows;
    const current=scenarioForAccount(p.account,"",p.scenario,settings);
    if(current.version!==p.version)throw new PlanningError("These assumptions changed. Reload the forecast before saving.");
    if(moneyCents(p.daily)<moneyCents(current.minimumDaily)||moneyCents(p.buffer)<moneyCents(current.minimumBuffer))
      throw new PlanningError("Conservative spending and buffer must be at least their base amounts.");
    await tx.query(`INSERT INTO forecast_scenarios(workspace_id,account_id,scenario,daily,buffer,version) VALUES($1,$2,$3,$4,$5,1)
      ON CONFLICT(workspace_id,account_id,scenario) DO UPDATE SET daily=excluded.daily,buffer=excluded.buffer,version=forecast_scenarios.version+1`,
      [s.workspace,p.account,p.scenario,p.daily,p.buffer]);
  });
}
export type {Setting as ScenarioSetting};
