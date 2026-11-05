import {beforeAll,beforeEach,afterAll,it,expect,vi} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {drizzle} from "drizzle-orm/pglite";
import {migrate} from "drizzle-orm/pglite/migrator";
import {randomUUID} from "node:crypto";
import {checkAffordability,saveForecastBaseline,listForecastBaselines,compareForecastBaseline} from "../affordability-store";
import {previewPurchase,keepForecastPlan} from "../affordability-actions";
import {moneyCents} from "../statement-review";

const session=vi.hoisted(()=>({workspaceId:"home",user:{id:"owner"}}));
vi.mock("../session",()=>({getSession:async()=>session}));
vi.mock("../household-db",()=>({getPlanningDb:async()=>db}));
const db=new PGlite(),scope={workspace:"home",actor:"owner"},now=new Date("2026-11-05T15:00:00Z");
const options={account:"bank",horizon:"30" as const,scenario:"base" as const,includeExpectedPay:false};
const input={options,amount:"500",date:"2026-11-07"};
const check=(raw:unknown=input,at=now)=>checkAffordability(db,scope,raw,at);
const snapshot=async()=>(await db.query(`SELECT
  (SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM accounts a) AS accounts,
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM transactions t) AS entries,
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM transfers t) AS transfers,
  (SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM recurring r) AS schedules,
  (SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM goal_reservations r) AS reservations`)).rows;
async function save(){const result=await check();const request={id:randomUUID(),options,fingerprint:result.fingerprint};await saveForecastBaseline(db,scope,request,now);return request;}
beforeAll(()=>migrate(drizzle(db),{migrationsFolder:"./drizzle"}),60000);
beforeEach(async()=>{
  session.workspaceId="home";session.user.id="owner";
  await db.exec(`TRUNCATE users,workspaces CASCADE;
    INSERT INTO users(id,email,password_hash) VALUES('owner','o@example.invalid','x'),('partner','p@example.invalid','x'),('viewer','v@example.invalid','x');
    INSERT INTO workspaces(id,name,owner_id) VALUES('home','Home','owner'),('private','Private','partner');
    INSERT INTO workspace_members(workspace_id,user_id,role) VALUES('home','owner','owner'),('home','partner','member'),('home','viewer','viewer'),('private','partner','owner');
    INSERT INTO household_setup(workspace_id,timezone) VALUES('home','America/Toronto');
    INSERT INTO app_settings(workspace_id,currency_code) VALUES('home','CAD');
    INSERT INTO accounts(id,name,type,workspace_id,initial_balance) VALUES('bank','Chequing','bank','home',1000),('other','Savings','bank','home',0),('secret','Private','bank','private',999);
    INSERT INTO transactions(id,workspace_id,account_id,type,amount,date,note) VALUES('old-in','home','bank','income',1,'2026-11-04','Income'),('old-out','home','bank','expense',1,'2026-11-04','Expense');
    INSERT INTO recurring(id,workspace_id,account_id,type,amount,note,frequency,next_date,max_occurrences,auto_post) VALUES('bill','home','bank','expense',100,'Utility','monthly','2026-11-06',1,false);
    INSERT INTO goals(id,workspace_id,name,target_amount) VALUES('goal','home','Savings',500);
    INSERT INTO goal_reservations(id,workspace_id,actor_id,goal_id,account_id,delta) VALUES('hold','home','owner','goal','bank',200);
    INSERT INTO forecast_scenarios(workspace_id,account_id,scenario,daily,buffer,version) VALUES('home','bank','base',0,100,1);`);
});
afterAll(()=>db.close());

it("uses exact cents, preserves reserved cash and buffers, and never posts the purchase",async()=>{
  const before=await snapshot(),result=await check();
  expect(result.calculation).toMatchObject({status:"within_plan",baseline:{lowest:"900.00",date:"2026-11-06",available:"600.00"},proposed:{lowest:"400.00",date:"2026-11-07",available:"100.00"},difference:"-500.00"});
  expect((await check({...input,amount:"600.01"})).calculation).toMatchObject({status:"shortfall",proposed:{available:"-0.01"}});
  expect((await check({...input,amount:"500.37",date:"2026-11-05"})).calculation?.proposed.lowest).toBe("399.63");
  await expect(check({...input,date:"2026-11-04"})).rejects.toThrow("within");
  await expect(check({...input,date:"2027-01-01"})).rejects.toThrow("within");
  await expect(check({...input,amount:"0"})).rejects.toThrow();
  expect(await snapshot()).toEqual(before);
  expect((await db.query("SELECT * FROM forecast_baselines")).rows).toHaveLength(0);
});
it("finds the pre-deposit low when income moves seven days and includes everyday spending only from tomorrow",async()=>{
  await db.exec("INSERT INTO transactions(id,workspace_id,account_id,type,amount,date,note) VALUES('pay','home','bank','income',500,'2026-11-08','Pay')");
  const result=await check({...input,amount:"300",date:"2026-11-10"});
  expect(result.calculation).toMatchObject({baseline:{lowest:"900.00"},proposed:{lowest:"900.00"},difference:"0.00",sensitivity:{label:"Pay",delayedDate:"2026-11-15",result:{lowest:"600.00",date:"2026-11-10"}}});
  await db.exec("UPDATE forecast_scenarios SET daily=2 WHERE account_id='bank'");
  expect((await check({...input,amount:"100",date:"2026-11-05"})).calculation).toMatchObject({baseline:{lowest:"896.00",date:"2026-11-07"},proposed:{lowest:"796.00",date:"2026-11-07"}});
});
it("withholds a confident answer for missing evidence, assumptions, exchange rates and unsupported converted transfers",async()=>{
  await db.exec("DELETE FROM transactions");
  expect((await check()).calculation?.status).toBe("incomplete");
  await db.exec("DELETE FROM forecast_scenarios");
  expect((await check()).issues.join(" ")).toMatch(/Confirm everyday spending/);
  await db.exec(`INSERT INTO finance_books(workspace_id,currency) VALUES('home','CAD');
    INSERT INTO finance_accounts(workspace_id,account_id,role,reviewed_balance,adjustment,interpretation,reviewer) VALUES('home','bank','cash',1000,0,'signed','owner'),('home','other','cash',0,0,'signed','owner');
    INSERT INTO account_denominations(workspace_id,account_id,currency) VALUES('home','bank','USD');`);
  const foreign=await check();expect(foreign.calculation).toBeNull();expect(foreign.issues.join(" ")).toMatch(/Missing exchange-rate/);
  await db.exec("UPDATE account_denominations SET currency='CAD'; INSERT INTO account_denominations VALUES('home','other','USD'); INSERT INTO transfers(id,workspace_id,from_account_id,to_account_id,amount,date) VALUES('fx','home','bank','other',10,'2026-11-06')");
  expect((await check()).issues.join(" ")).toMatch(/Cross-currency/);
});
it("saves only the original plan by explicit request, retries once and rejects stale or reused requests",async()=>{
  const before=await snapshot(),request=await save();
  await saveForecastBaseline(db,scope,request,now);
  expect((await db.query("SELECT * FROM forecast_baselines")).rows).toHaveLength(1);
  const stored=(await db.query<{evidence:{events:unknown[]}}>("SELECT evidence FROM forecast_baselines")).rows[0].evidence;
  expect(JSON.stringify(stored)).not.toMatch(/temporary-purchase|Utility|Chequing/);
  expect((await listForecastBaselines(db,scope,"bank")).items).toHaveLength(1);
  await expect(saveForecastBaseline(db,scope,{...request,fingerprint:"0".repeat(64)},now)).rejects.toThrow("another forecast");
  const outdated=(await check()).fingerprint;
  await db.exec("UPDATE recurring SET amount=101 WHERE id='bill'");
  await expect(saveForecastBaseline(db,scope,{id:randomUUID(),options,fingerprint:outdated},now)).rejects.toThrow("changed");
  await db.exec("UPDATE recurring SET amount=100 WHERE id='bill'");
  expect(await snapshot()).toEqual(before);
});
it("explains early bills, unplanned expenses, refunds, transfers and later corrections with an exact reconciliation",async()=>{
  await db.exec("UPDATE recurring SET next_date='2026-11-08'; INSERT INTO transactions(id,workspace_id,account_id,type,amount,date,note) VALUES('known','home','bank','expense',40,'2026-11-09','Known bill')");
  const request=await save();
  await db.exec(`UPDATE transactions SET amount=45 WHERE id='known'; UPDATE transactions SET amount=6 WHERE id='old-in';
    INSERT INTO transactions(id,workspace_id,account_id,type,amount,date,note) VALUES
      ('early','home','bank','expense',100,'2026-11-07','Utility'),('extra','home','bank','expense',20,'2026-11-10','Unexpected repair'),('refund','home','bank','income',5,'2026-11-10','Partial refund');
    INSERT INTO transfers(id,workspace_id,from_account_id,to_account_id,amount,date) VALUES('move','home','bank','other',10,'2026-11-10');
    INSERT INTO refund_links(id,workspace_id,actor_id,credit_id,purchase_id,portions) VALUES('refund-link','home','owner','refund','extra','[]');`);
  const comparison=await compareForecastBaseline(db,scope,"bank",request.id,new Date("2026-11-10T15:00:00Z"));
  expect(comparison).toMatchObject({expected:"860.00",actual:"835.00",difference:"-25.00"});
  expect(comparison.lines.find(l=>l.key==="opening")).toMatchObject({kind:"correction",difference:"5.00"});
  expect(comparison.lines.find(l=>l.key==="entry-known")).toMatchObject({kind:"correction",difference:"-5.00"});
  expect(comparison.lines.find(l=>l.key==="rule-bill-2026-11-08")).toMatchObject({kind:"timing",difference:"0.00",actualDate:"2026-11-07"});
  expect(comparison.lines.reduce((s,l)=>s+moneyCents(l.difference),BigInt(0))).toBe(BigInt(-2500));
  expect(await compareForecastBaseline(db,scope,"bank",request.id,new Date("2026-11-07T15:00:00Z"))).toMatchObject({expected:"1000.00",actual:"905.00",difference:"-95.00"});
});
it("protects member and source visibility and rejects another tracker's actions",async()=>{
  const request=await save();
  expect((await listForecastBaselines(db,{...scope,actor:"partner"},"bank")).items).toHaveLength(0);
  await expect(compareForecastBaseline(db,{...scope,actor:"partner"},"bank",request.id,now)).rejects.toThrow("unavailable");
  await expect(saveForecastBaseline(db,{...scope,actor:"viewer"},{...request,id:randomUUID()},now)).rejects.toThrow("Access");
  await expect(check({...input,options:{...options,account:"secret"}})).rejects.toThrow("current tracker");
  session.workspaceId="private";
  expect((await previewPurchase("home",input)).ok).toBe(false);
  expect((await keepForecastPlan("home",request)).ok).toBe(false);
  await db.exec("UPDATE goals SET workspace_id='private' WHERE id='goal'");
  expect((await listForecastBaselines(db,scope,"bank")).items).toHaveLength(0);
  await expect(compareForecastBaseline(db,scope,"bank",request.id,now)).rejects.toThrow("source access");
  await db.exec("DELETE FROM workspace_members WHERE workspace_id='home' AND user_id='owner'");
  expect((await db.query("SELECT * FROM forecast_baselines")).rows).toHaveLength(0);
});
it("keeps duplicate bill matches and linked refunds unconfirmed instead of inventing a cause",async()=>{
  await db.exec(`INSERT INTO recurring(id,workspace_id,account_id,type,amount,note,frequency,next_date,max_occurrences,auto_post) VALUES
    ('duplicate','home','bank','expense',100,'Utility','monthly','2026-11-06',1,false),
    ('credit','home','bank','income',1,'Credit','monthly','2026-11-06',1,false);`);
  const request=await save();
  await db.exec(`INSERT INTO transactions(id,workspace_id,account_id,type,amount,date,note) VALUES
    ('first','home','bank','expense',100,'2026-11-06','Utility'),('second','home','bank','expense',100,'2026-11-06','Utility'),
    ('refund','home','bank','income',1,'2026-11-06','Credit');
    INSERT INTO refund_links(id,workspace_id,actor_id,credit_id,purchase_id,portions) VALUES('linked','home','owner','refund','old-out','[]');`);
  const comparison=await compareForecastBaseline(db,scope,"bank",request.id,new Date("2026-11-07T15:00:00Z"));
  expect(comparison).toMatchObject({expected:"801.00",actual:"801.00",difference:"0.00"});
  expect(comparison.lines.filter(line=>line.kind==="unconfirmed")).toHaveLength(3);
  expect(comparison.lines.find(line=>line.key==="entry-refund")).toMatchObject({kind:"recorded",actual:"1.00"});
  expect(comparison.lines.reduce((total,line)=>total+moneyCents(line.difference),BigInt(0))).toBe(BigInt(0));
  await db.exec("UPDATE accounts SET workspace_id='private' WHERE id='bank'");
  await expect(compareForecastBaseline(db,scope,"bank",request.id,now)).rejects.toThrow("current tracker");
});
it("supports a temporary check when baseline storage is not yet migrated",async()=>{
  await db.exec("ALTER TABLE forecast_baselines RENAME TO held_forecast_baselines");
  try {expect(await check()).toMatchObject({canSave:false,calculation:{status:"within_plan"}});expect((await listForecastBaselines(db,scope,"bank")).available).toBe(false);}
  finally {await db.exec("ALTER TABLE held_forecast_baselines RENAME TO forecast_baselines");}
});
