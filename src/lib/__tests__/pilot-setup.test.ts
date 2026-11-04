import { beforeAll,beforeEach,afterAll,expect,it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { reviewOpening,savePreferences,setupProgress,recordFeedback } from "../pilot-setup";
import { activityFilterSchema,queryActivity } from "../activity-query";
import { activityPart,activityCsv,workbookFits } from "../activity-exports";
import { defaultMapping } from "../file-import-model";
import { stageBatch,approveBatch } from "../file-import-store";
import { pilotReport } from "../pilot-scorecard";
import type { AppDb } from "../db";
import template from "../../../docs/pilot-evidence.empty.json";

const client=new PGlite(),local=drizzle(client),db=local as unknown as AppDb;
const owner={workspace:"home",actor:"owner",name:"Owner"};
const allSheets={finance:true,planning:true,imports:true,reviews:true};
beforeAll(()=>migrate(local,{migrationsFolder:"drizzle"}),60000);
beforeEach(async()=>{await client.exec(`TRUNCATE users,workspaces CASCADE;
  INSERT INTO users(id,email,password_hash) VALUES('owner','owner@example.test','x'),('viewer','viewer@example.test','x'),('outsider','outsider@example.test','x');
  INSERT INTO workspaces(id,owner_id,name) VALUES('home','owner','Home'),('other','outsider','Other');
  INSERT INTO workspace_members(workspace_id,user_id,role) VALUES('home','owner','owner'),('home','viewer','viewer'),('other','outsider','owner');
  INSERT INTO accounts(id,workspace_id,name,initial_balance) VALUES('bank','home','Bank',100),('cash','home','Cash',0),('hidden','other','Private',0);
  INSERT INTO transactions(id,workspace_id,account_id,type,amount,date,note) VALUES('existing','home','bank','income',10,'2025-01-01','Salary'),('secret','other','hidden','expense',10,'2025-01-01','Secret');
  INSERT INTO transfers(id,workspace_id,from_account_id,to_account_id,amount,date) VALUES('move','home','bank','cash',6,'2025-01-02');`);});
afterAll(()=>client.close());

it("resumes setup from stored preferences and ledger facts; rejects foreign access and mismatched openings",async()=>{
  expect((await setupProgress(client,owner)).partner).toBe(true);
  await expect(savePreferences(client,{...owner,actor:"viewer"},"CAD","UTC",false,false)).rejects.toThrow();
  await expect(savePreferences(client,owner,"CAD","Missing/Place",false,false)).rejects.toThrow();
  await savePreferences(client,owner,"CAD","America/Toronto",true,false);
  expect(await setupProgress(client,owner)).toMatchObject({currency:"CAD",timezone:"America/Toronto",bills_skipped:true});
  expect(await reviewOpening(client,owner,"bank","2025-01-02")).toMatchObject({count:2,balance:"104.00",opening:"100.00",cutoff:null});
  await expect(reviewOpening(client,owner,"bank","2099-01-01")).rejects.toThrow(/already closed/);
  await expect(reviewOpening(client,owner,"bank","2025-01-02","105")).rejects.toThrow(/differ/);
  await expect(reviewOpening(client,owner,"hidden","2025-01-02")).rejects.toThrow();
  await expect(setupProgress(client,{workspace:"other",actor:"owner"})).rejects.toThrow();
  await reviewOpening(client,owner,"bank","2025-01-02","104");
  expect((await setupProgress(client,owner)).accounts[0].cutoff).toBe("2025-01-02");
  await expect(reviewOpening(client,owner,"bank","2025-02-02","104")).rejects.toThrow(/already/);
  expect((await client.query<{balance:string}>("SELECT initial_balance::text AS balance FROM accounts WHERE id='bank'")).rows[0].balance).toBe("100.00");
});

it("atomically refuses a stale import, permits matching a covered row, and accepts later activity",async()=>{
  const headers=["date","type","amount","account","note"];
  const file={hash:"fixture",filename:"sample.csv",headers,lines:[
    {line:2,cells:["2025-01-01","income","10","Bank","salary"]},
    {line:3,cells:["2025-01-03","expense","9","Bank","later"]}]};
  const map=defaultMapping(headers);
  const stale=await stageBatch(db,owner,file,map,"INR");
  await reviewOpening(client,owner,"bank","2025-01-02","104");
  await expect(approveBatch(db,owner,stale.id,stale.version,{"2":"separate","3":"import"})).rejects.toThrow();
  expect((await client.query<{n:number}>("SELECT count(*)::int AS n FROM transactions WHERE workspace_id='home'")).rows[0].n).toBe(1);
  const legacy=await client.query<{inserted:number}>("SELECT import_legacy_entries($1,$2,$3) AS inserted",["home","owner",JSON.stringify([{accountId:"bank",date:"2025-01-01",amount:10,type:"income",note:"old"}])]);
  expect(legacy.rows[0].inserted).toBe(0);
  const fresh=await stageBatch(db,owner,file,map,"INR");
  expect(fresh.rows.map(r=>r.cutoff)).toEqual(["2025-01-02",undefined]);
  const approved=await approveBatch(db,owner,fresh.id,fresh.version,{"2":"match:existing","3":"import"});
  expect(approved.receipt?.map(r=>r.action)).toEqual(["match","import"]);
});

it("protects shared closure, scopes feedback, and limits submissions",async()=>{
  await expect(client.query("DELETE FROM users WHERE id='owner'")).rejects.toThrow(/ownership/);
  await expect(recordFeedback(client,{workspace:"other",actor:"viewer"},"blocked","Cannot continue")).rejects.toThrow();
  await expect(recordFeedback(client,owner,"unknown","Issue")).rejects.toThrow();
  for(let i=0;i<5;i++) expect(await recordFeedback(client,owner,"blocked","Keyboard focus lost")).toHaveLength(36);
  await expect(recordFeedback(client,owner,"blocked","Try again")).rejects.toThrow(/five/);
});

it("limits large exports and offers consecutive, formula-safe, household-scoped parts",async()=>{
  expect(await workbookFits(db,"home",allSheets)).toBe(true);
  await client.exec("INSERT INTO transactions(id,workspace_id,account_id,type,amount,date) SELECT 'fixture-'||n,'home','bank','income',1,'2025-01-02' FROM generate_series(1,12000)n");
  expect(await workbookFits(db,"home",allSheets)).toBe(false);
  expect(await workbookFits(db,"other",allSheets)).toBe(true);
  const a=await activityPart(db,"home","owner","transactions","");
  const b=await activityPart(db,"home","owner","transactions",a.next!);
  expect(a.rows).toHaveLength(500);expect(b.rows).toHaveLength(500);
  expect(new Set([...a.rows,...b.rows].map(r=>r.id)).size).toBe(1000);
  expect((await activityPart(db,"other","owner","transactions","")).rows).toEqual([]);
  expect(activityCsv([{note:' =CMD("x")'}])).toContain('"\' =CMD(""x"")"');
});

it("reads the oldest end of a partial or out-of-range final Activity page without dropping ties",async()=>{
  await client.exec("INSERT INTO transactions(id,workspace_id,account_id,type,amount,date,created_at) SELECT 't'||n,'home','bank','income',1,'2026-01-01','2026-01-01' FROM generate_series(1,7)n");
  const f=activityFilterSchema.parse({start:"2026-01-01",end:"2026-02-01",pageSize:3});
  for(const [page,ids] of [[1,["t7","t6","t5"]],[2,["t4","t3","t2"]],[3,["t1"]],[800,["t1"]]] as const) {
    const result=await queryActivity(db,"home",{...f,page},false);
    expect(result.transactions.map(t=>t.id)).toEqual(ids);
  }
});

it("keeps missing pilot evidence unknown, distinguishes zero spend and reports the measured cohort",()=>{
  const e=structuredClone(template);
  expect(pilotReport(e)).toMatchObject({setupTarget:"insufficient observations",costPerActiveHousehold:null,weekFour:{retention:null}});
  const report=pilotReport({...e,pilotHouseholds:5,activeHouseholds:4,tasks:{...e.tasks,setup:{attempted:5,assisted:0,unassisted:4}},
    firstFiveSetups:["unassisted","unassisted","unassisted","unassisted","incomplete"],costs:{provider:0,hosting:12,storage:2,notifications:2},supportMinutes:20,familiarCaptureSeconds:[7,8,12,20],weekFour:{eligible:4,returned:3}});
  expect(report).toMatchObject({setupTarget:"met",costPerActiveHousehold:4,supportMinutesPerActiveHousehold:5,familiarCapture:{medianSeconds:10},weekFour:{retention:0.75}});
  expect(()=>pilotReport({...e,weekFour:{eligible:0,returned:1}})).toThrow();
});
