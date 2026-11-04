import {beforeAll,afterAll,expect,it} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {drizzle} from "drizzle-orm/pglite";
import {migrate} from "drizzle-orm/pglite/migrator";
import {saveForecastScenario} from "../forecast-scenario";
import {forecastBalances} from "../balance-forecast";
import {decisionOverview} from "../decision-overview";
import {explainForecast} from "../forecast-explanation";
import {activityFilterSchema,queryActivity} from "../activity-query";
import type {AppDb} from "../db";

const db=new PGlite(),scope={workspace:"home",actor:"viewer"},asOf=new Date(2024,0,31,12);
const forecast=(account:string|null,horizon:"30"|"60"|"90"|"payday")=>forecastBalances(db,scope,{account,horizon},asOf);
beforeAll(async()=>{
  await migrate(drizzle(db),{migrationsFolder:"./drizzle"});
  await db.exec(`INSERT INTO users(id,email,password_hash) VALUES('viewer','v@example.invalid','x');
    INSERT INTO workspaces(id,name,owner_id) VALUES('home','Home','viewer'),('away','Away','viewer');
    INSERT INTO workspace_members(workspace_id,user_id,role) VALUES('home','viewer','viewer');
    INSERT INTO accounts(id,workspace_id,name,type,initial_balance) VALUES('a','home','Bank','bank',100),('b','home','Cash','cash',50),('c','away','Private','cash',1000);
    INSERT INTO transactions(id,workspace_id,account_id,type,note,amount,date) VALUES
      ('old','home','a','income','Posted',10,'2024-01-31'),('rent','home','a','expense','Rent',12.35,'2024-02-01'),
      ('march','home','b','income','Gift',3,'2024-03-02'),('april','home','b','expense','April',8,'2024-04-30'),
      ('outside','home','b','income','Later',500,'2024-05-01'),('unassigned','home',NULL,'income','No account',1000,'2024-02-01');
    INSERT INTO transfers(id,workspace_id,from_account_id,to_account_id,amount,date) VALUES
      ('opening','home','a','b',5,'2024-01-10'),('planned','home','a','b',20,'2024-02-02');
    INSERT INTO recurring(id,workspace_id,account_id,type,note,amount,frequency,next_date,end_date,max_occurrences,auto_post) VALUES
      ('one','home','a','expense','Rent',12.35,'monthly','2024-02-01',NULL,1,true),
      ('two','home','a','expense','Rent',12.35,'monthly','2024-02-01',NULL,1,true),
      ('income','home','a','income','Scheduled income',30,'weekly','2024-02-03','2024-02-03',NULL,true),
      ('variable','home','a','expense','Utility',4.44,'monthly','2024-01-31',NULL,3,false),
      ('foreign','away','c','income','Other household',1000,'weekly','2024-02-01',NULL,NULL,true);
    INSERT INTO pay_period_plans(workspace_id,account_id,start_date,next_date,cadence,expected,spending_limit)
      VALUES('home','a','2024-01-26','2024-02-02','weekly',900,300);`);
},60000);
afterAll(()=>db.close());
it("traces balances to their cutoff and exact workspace-scoped source records",async()=>{
  const data=await forecast(null,"30");
  expect(explainForecast(data,"opening")?.result).toBe(data.opening);
  expect(explainForecast(data,"closing")?.result).toBe(data.projection!.closing);
  const lowest=explainForecast(data,"lowest")!;
  expect(lowest.result).toBe(data.projection!.lowest);
  expect(lowest.groups.map(g=>g.label)).toEqual(["Accounts at the start","2024-02-01"]);
  const rent=lowest.groups[1].lines.find(l=>l.matchedSchedule)!;
  expect(rent.matchedSchedule).toBe("#schedule-one");
  const params=new URL(rent.href,"http://localhost").searchParams;
  const filter=activityFilterSchema.parse({...Object.fromEntries(params),start:"2024-02-01",end:"2024-02-02"});
  const store=drizzle(db) as unknown as AppDb;
  expect((await queryActivity(store,"home",filter,false)).transactions.map(t=>t.id)).toEqual(["rent"]);
  expect((await queryActivity(store,"away",filter,false)).total).toBe(0);
  const transfer=await queryActivity(store,"home",{...filter,start:"2024-02-02",end:"2024-02-03",type:"transfer",entry:"planned"},false);
  expect(transfer.transfers.map(t=>t.id)).toEqual(["planned"]);
  expect(explainForecast(data,"spendable")).toBeNull();
});
it("summarizes the same base forecast on Overview and keeps the result workspace-scoped",async()=>{
  const full=await forecast(null,"30");
  const overview=await decisionOverview(db,scope,asOf);
  expect(overview).toMatchObject({month:"2024-01",start:full.start,end:full.end,closing:full.projection?.closing,
    coverage:{accounts:full.coverage.accounts,bills:[]},lowestCash:full.projection?.lowestCash,unreviewed:0,goals:[]});
  expect(overview.upcomingCount).toBe(5);
  expect(overview.upcoming.map(e=>e.key)).toEqual(full.projection!.days.flatMap(d=>d.events).slice(0,3).map(e=>e.key));
  await expect(decisionOverview(db,{...scope,workspace:"away"},asOf)).rejects.toThrow("Access");
});
it("reconciles accounts, neutral household transfers and one-to-one possible matches",async()=>{
  const all=await forecast(null,"30"),bank=await forecast("a","30"),cash=await forecast("b","30");
  expect(all).toMatchObject({start:"2024-01-31",end:"2024-03-01",opening:"160.00",projection:{closing:"160.86",lowest:"135.30",lowDate:"2024-02-01"}});
  expect(bank).toMatchObject({opening:"105.00",projection:{closing:"85.86",lowest:"60.30",lowDate:"2024-02-02"}});
  expect(cash).toMatchObject({opening:"55.00",projection:{closing:"75.00"}});
  const days=all.projection!.days;
  expect(days[0].events.map(e=>[e.source,e.change,!!e.overlap])).toEqual([["Ledger","-12.35",true],["Schedule","-12.35",false]]);
  expect(days[1].events[0].change).toBe("0.00");
  expect(days.at(-1)).toMatchObject({date:"2024-02-29",events:[{source:"Bill estimate",change:"-4.44"}]});
  expect(all.warnings.some(w=>w.includes("without a tracked account"))).toBe(true);
  expect(await forecast(null,"30")).toEqual(all);
  expect((await db.query("SELECT next_date::text,occurrence_count FROM recurring WHERE id='variable'")).rows)
    .toEqual([{next_date:"2024-01-31",occurrence_count:0}]);
  expect((await db.query("SELECT count(*)::int AS n FROM transactions")).rows[0]).toEqual({n:6});
});
it("uses inclusive horizons and saved payday boundaries without adding an estimated paycheck",async()=>{
  expect(await forecast(null,"payday")).toMatchObject({end:"2024-02-02",projection:{closing:"135.30"}});
  expect(await forecast("b","payday")).toMatchObject({end:null,projection:null});
  expect(await forecast(null,"60")).toMatchObject({end:"2024-03-31",projection:{closing:"159.42"}});
  expect(await forecast(null,"90")).toMatchObject({end:"2024-04-30",projection:{closing:"151.42"}});
  await expect(forecast("c","30")).rejects.toThrow("workspace");
  await expect(forecastBalances(db,{...scope,workspace:"away"},{account:null,horizon:"30"},asOf)).rejects.toThrow("Access");
});

it("keeps scenario assumptions separate, finds pre-deposit lows, and excludes noncash assets from spending capacity",async()=>{
  const owner={workspace:"scenario-home",actor:"owner"};
  await db.exec(`INSERT INTO users(id,email,password_hash) VALUES('owner','owner@example.invalid','x');
    INSERT INTO workspaces(id,name,owner_id) VALUES('scenario-home','Scenario test','owner');
    INSERT INTO workspace_members(workspace_id,user_id,role) VALUES('scenario-home','owner','owner'),('scenario-home','viewer','viewer');
    INSERT INTO accounts(id,workspace_id,name,type,initial_balance) VALUES('bank','scenario-home','Checking','bank',100),
      ('coins','scenario-home','Coins','cash',0),('card','scenario-home','Other balance','card',500);
    INSERT INTO goals(id,workspace_id,name,target_amount) VALUES('holiday','scenario-home','Holiday',200);
    INSERT INTO goal_reservations(id,workspace_id,actor_id,goal_id,account_id,delta) VALUES('hold','scenario-home','owner','holiday','bank',20);
    INSERT INTO transactions(id,workspace_id,account_id,type,note,amount,date) VALUES
      ('purchase','scenario-home','bank','expense','Bill',10,'2024-02-01'),('deposit','scenario-home','bank','income','Pay',100,'2024-02-04');
    INSERT INTO transfers(id,workspace_id,from_account_id,to_account_id,amount,date) VALUES('repay','scenario-home','bank','card',15,'2024-02-02');
    INSERT INTO recurring(id,workspace_id,account_id,type,note,amount,frequency,next_date,max_occurrences) VALUES
      ('confirmed','scenario-home','bank','income','Pay',100,'weekly','2024-02-04',1),
      ('possible','scenario-home','bank','income','Bonus',60,'weekly','2024-02-05',1);`);
  const read=(scenario:"base"|"conservative",account:string|null=null)=>forecastBalances(db,owner,{scenario,horizon:"30",account},asOf);
  const base={account:"bank",scenario:"base",daily:"5.00",buffer:"10",version:0};
  await expect(saveForecastScenario(db,{...owner,actor:"viewer"},base)).rejects.toThrow("Access");
  await expect(saveForecastScenario(db,owner,{...base,account:"a"})).rejects.toThrow("workspace");
  await expect(saveForecastScenario(db,owner,{...base,account:"card"})).rejects.toThrow("cash account");
  await expect(saveForecastScenario(db,owner,{...base,daily:"-1"})).rejects.toThrow();
  await saveForecastScenario(db,owner,base);
  await expect(saveForecastScenario(db,owner,base)).rejects.toThrow("changed");
  expect((await read("base")).projection?.spendable).toBeNull();
  await saveForecastScenario(db,owner,{...base,account:"coins",daily:"0",buffer:"0"});
  expect(await read("base","bank")).toMatchObject({opening:"100.00",reserved:"20.00",buffer:"10.00",
    projection:{closing:"85.00",lowestCash:"60.00",cashLowDate:"2024-02-03",spendable:"30.00"}});
  expect(await read("base")).toMatchObject({opening:"600.00",projection:{closing:"600.00",spendable:"30.00"}});
  expect((await read("conservative","bank")).assumptions[0]).toMatchObject({daily:"5.00",buffer:"10.00",configured:true,version:0});
  const conservative={...base,scenario:"conservative",daily:"6",buffer:"15"};
  await expect(saveForecastScenario(db,owner,{...conservative,daily:"4.99"})).rejects.toThrow("at least");
  await saveForecastScenario(db,owner,conservative);
  const cautious=await read("conservative");
  expect(cautious.projection).toMatchObject({lowestCash:"-5.00",cashLowDate:"2024-03-01",spendable:"-40.00"});
  expect(explainForecast(cautious,"lowestCash")?.result).toBe("-5.00");
  const explanation=explainForecast(cautious,"spendable")!;
  expect(explanation.result).toBe("-40.00");
  expect(explanation.groups.slice(-2).map(g=>g.amount)).toEqual(["-20.00","-15.00"]);
  expect(explanation.groups[0].lines.map(l=>l.label)).not.toContain("Other balance");
  expect(cautious.projection?.days.flatMap(d=>d.events).filter(e=>e.label==="Pay")).toHaveLength(1);
  await saveForecastScenario(db,owner,{...base,version:1,daily:"7",buffer:"20"});
  expect((await read("conservative","bank")).assumptions[0]).toMatchObject({daily:"7.00",buffer:"20.00"});
  expect((await db.query("SELECT count(*)::int AS n FROM transactions WHERE workspace_id='scenario-home'")).rows).toEqual([{n:2}]);
});

it("reconciles period income targets and installment forecasts against dated sources without posting money",async()=>{
  await db.exec(`INSERT INTO workspaces(id,name,owner_id) VALUES('m6','Commitments','viewer');
    INSERT INTO workspace_members(workspace_id,user_id,role) VALUES('m6','viewer','viewer');
    INSERT INTO accounts(id,workspace_id,name,type,initial_balance) VALUES('pay','m6','Payroll','bank',1000),('cc','m6','Card','card',-200);
    INSERT INTO pay_period_plans(workspace_id,account_id,start_date,next_date,cadence,expected,spending_limit)
    VALUES('m6','pay','2024-01-29','2024-02-05','weekly',1000,200),('m6','pay','2024-02-05','2024-02-12','weekly',300,150);
    INSERT INTO transactions(id,workspace_id,account_id,type,note,amount,date) VALUES
      ('early','m6','pay','income','Partial pay',150,'2024-01-29'),('confirmed-wage','m6','pay','income','Wages',250,'2024-02-01'),
      ('extra-wage','m6','pay','income','Next period',500,'2024-02-05'),
      ('refund','m6','pay','income','Return',60,'2024-01-30'),('returned-purchase','m6','pay','expense','Purchase',60,'2024-01-29');
    INSERT INTO refund_links(id,workspace_id,actor_id,credit_id,purchase_id,portions)
      VALUES('rf','m6','viewer','refund','returned-purchase','[{"categoryId":null,"amount":"60.00"}]');
    INSERT INTO transfers(id,workspace_id,from_account_id,to_account_id,amount,date,note)
      VALUES('repayment','m6','pay','cc',50,'2024-02-03','  Card Plan ');
    INSERT INTO recurring(id,workspace_id,account_id,type,note,amount,frequency,next_date,max_occurrences,commitment_type) VALUES
      ('wages','m6','pay','income','Wages',250,'weekly','2024-02-01',1,'other'),
      ('additional-wages','m6','pay','income','Second job',200,'weekly','2024-02-02',1,'other'),
      ('emi','m6','pay','expense','card plan',50,'monthly','2024-02-03',1,'emi'),
      ('external-emi','m6','pay','expense','External loan',25,'monthly','2024-02-01',1,'emi');`);
  const read=(includeExpectedPay:boolean,scenario="base",account:string|null=null)=>forecastBalances(db,{...scope,workspace:"m6"},
    {horizon:"30",scenario,account,includeExpectedPay},asOf);
  const base=await read(false),full=await read(true);
  expect(base.payEstimates).toEqual([]);
  expect(full.payEstimates).toMatchObject([
    {date:"2024-02-04",expected:"1000.00",recorded:"400.00",scheduled:"200.00",remainder:"400.00"},
    {date:"2024-02-11",recorded:"500.00",scheduled:"0.00",remainder:"0.00"}]);
  const events=full.projection!.days.flatMap(d=>d.events);
  expect(events.filter(e=>e.source==="Expected pay").map(e=>[e.date,e.change])).toEqual([["2024-02-04","400.00"]]);
  expect(events.filter(e=>e.source==="Card repayment")).toMatchObject([{change:"0.00",cashChange:"-50.00",matchedSchedule:"#schedule-emi"}]);
  expect(events.filter(e=>e.source==="Installment").map(e=>e.change)).toEqual(["-25.00"]);
  expect(Number(full.projection!.closing)-Number(base.projection!.closing)).toBe(400);
  expect(explainForecast(full,"closing")?.result).toBe(full.projection!.closing);
  expect((await read(true,"conservative")).payEstimates).toEqual([]);
  expect((await read(true,"base","cc")).payEstimates).toEqual([]);
  expect((await read(true,"base","cc")).projection!.days.flatMap(d=>d.events).find(e=>e.source==="Card repayment")?.change).toBe("50.00");
  await db.exec("UPDATE transfers SET note='Unrelated transfer' WHERE id='repayment'");
  const ambiguous=await read(true);
  expect(ambiguous.projection!.days.flatMap(d=>d.events).filter(e=>e.source==="Installment")).toHaveLength(2);
  expect(ambiguous.warnings.some(w=>w.includes("Check their notes"))).toBe(true);
  expect((await db.query("SELECT count(*)::int AS n FROM transactions WHERE workspace_id='m6'")).rows).toEqual([{n:5}]);
  await db.exec(`UPDATE transfers SET note='Card Plan' WHERE id='repayment';
    INSERT INTO transactions(id,workspace_id,account_id,type,note,amount,date)
    VALUES('also-recorded','m6','pay','expense','card plan',50,'2024-02-03')`);
  const conflict=await read(true);
  const onDueDate=conflict.projection!.days.find(d=>d.date==="2024-02-03")!;
  expect(onDueDate.events.map(e=>e.source)).toEqual(["Ledger","Card repayment"]);
  expect(conflict.warnings.some(w=>w.includes("both a ledger expense and a card transfer"))).toBe(true);
  await db.exec("UPDATE transactions SET note='Different deposit' WHERE id='confirmed-wage'");
  expect((await read(true)).warnings.some(w=>w.includes("Scheduled income and a dated deposit"))).toBe(true);
  expect(await forecastBalances(db,{...scope,workspace:"m6"},{account:null,horizon:"payday",includeExpectedPay:true},new Date(2024,1,4,12)))
    .toMatchObject({end:"2024-02-05",payEstimates:[]});
});
