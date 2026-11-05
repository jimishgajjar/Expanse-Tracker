/** Synthetic engineering exercise. Never loads application .env files or records participant evidence. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { Client, neon } from "@neondatabase/serverless";
import { drizzle as http } from "drizzle-orm/neon-http";
import { drizzle as embedded } from "drizzle-orm/pglite";
import { addDays, format } from "date-fns";
import * as schema from "../src/lib/db/schema";
import type { AppDb } from "../src/lib/db";
import { hostedHouseholdDb, type HouseholdDb } from "../src/lib/household-db";
import { reviewOpening, savePreferences, setupProgress } from "../src/lib/pilot-setup";
import { createWithHistory } from "../src/lib/transaction-create";
import { parseSource } from "../src/lib/file-import-parser";
import { defaultMapping } from "../src/lib/file-import-model";
import { approveBatch, loadBatch, stageBatch } from "../src/lib/file-import-store";
import { readStatementReview, saveStatementReview, startStatementReview } from "../src/lib/statement-review-store";
import { forecastBalances } from "../src/lib/balance-forecast";
import { weeklyHouseholdCheckIn } from "../src/lib/weekly-household";
import type { RecurringDTO } from "../src/lib/queries";

async function exercise(store: HouseholdDb, app: AppDb) {
  const actor = {id:randomUUID(), name:"Pilot fixture"};
  const account = randomUUID();
  const scope = {workspace:randomUUID(), actor:actor.id, name:actor.name};
  await store.transaction(async tx => {
    await tx.query("INSERT INTO users(id,email,password_hash,email_verified_at) VALUES ($1,$2,'disabled',now())",
      [actor.id, actor.id+"@example.invalid"]);
    await tx.query("INSERT INTO workspaces(id,owner_id,name) VALUES ($1,$2,'Synthetic household')", [scope.workspace,actor.id]);
    await tx.query("INSERT INTO workspace_members(workspace_id,user_id,role) VALUES ($1,$2,'owner')",[scope.workspace,actor.id]);
  });
  assert.equal((await setupProgress(store,scope)).accounts.length,0);
  await savePreferences(store,scope,"CAD","America/Toronto",false,true);
  await store.query("INSERT INTO accounts(id,workspace_id,name,type,initial_balance) VALUES ($1,$2,'Practice chequing','bank',100)",[account,scope.workspace]);
  await reviewOpening(store,scope,account,"2026-10-01","100.00");
  const resumed = await setupProgress(store,scope);
  assert.equal(resumed.timezone,"America/Toronto");
  assert.equal(resumed.currency,"CAD");
  assert.equal(resumed.accounts[0].cutoff,"2026-10-01");

  const ledger = async () => (await store.query(
    "SELECT id,amount::text,note FROM transactions WHERE workspace_id=$1 AND account_id=$2 ORDER BY date,id",[scope.workspace,account])).rows;
  const purchase = {requestId:randomUUID(),accountId:account,type:"expense",date:"2026-10-02",amount:"7.50",note:"Market"};
  const entry = await createWithHistory(app,scope.workspace,actor,purchase);
  assert.equal((await createWithHistory(app,scope.workspace,actor,purchase)).id,entry.id);
  const before = await ledger();
  assert.deepEqual(before,[{id:entry.id,amount:"7.50",note:"Market"}]);

  const csv = await readFile("docs/pilot-statement.csv","utf8");
  const source = await parseSource(new File([csv],"pilot-statement.csv"));
  const batch = await stageBatch(app,scope,source,{...defaultMapping(source.headers),fallback:account},"CAD");
  assert.deepEqual(await ledger(),before);
  assert.deepEqual(batch.rows.map(r=>r.candidates.map(c=>c.id)),[[entry.id],[]]);
  const decisions = {"2":"match:"+entry.id,"3":"import"};
  const result = await approveBatch(app,scope,batch.id,batch.version,decisions);
  assert.deepEqual(result.receipt?.map(row=>row.action),["match","import"]);
  assert.deepEqual((await loadBatch(app,scope,batch.id)).receipt,result.receipt);
  await approveBatch(app,scope,batch.id,batch.version,decisions);
  const posted = await ledger();
  assert.deepEqual(posted.map(row=>row.amount),["7.50","2.50"]);

  const reviewId = await startStatementReview(app,scope.workspace,actor,{id:randomUUID(),accountId:account,
    start:"2026-10-02",end:"2026-10-03",closingBalance:"90.00"});
  const draft = await readStatementReview(app,scope.workspace,actor.id,reviewId);
  const completion = {id:reviewId,version:draft.version,complete:true,duplicatesReviewed:true};
  await assert.rejects(saveStatementReview(app,scope.workspace,actor,{...completion,decisions:{}}),/exact difference/);
  const cleared = Object.fromEntries(draft.snapshot.entries.map(row=>[row.id,"cleared"]));
  assert.equal((await saveStatementReview(app,scope.workspace,actor,{...completion,decisions:cleared})).effectiveStatus,"completed");
  await assert.rejects(readStatementReview(app,scope.workspace,randomUUID(),reviewId),/not found|access/i);

  const clock = new Date();
  const today = format(clock,"yyyy-MM-dd"), due = format(addDays(clock,1),"yyyy-MM-dd");
  const bill: RecurringDTO = {id:randomUUID(),accountId:account,note:"Practice utility",type:"expense",amount:20,
    frequency:"monthly",nextDate:due,endDate:due,commitmentType:"bill",autoPost:false,categoryId:null,
    maxOccurrences:null,occurrenceCount:0,alertsEnabled:false,remindDaysBefore:0,totalAmount:null,priceHistory:[]};
  await store.query(`INSERT INTO recurring(id,workspace_id,account_id,type,amount,note,frequency,next_date,end_date,commitment_type,auto_post,alerts_enabled)
    VALUES ($1,$2,$3,'expense',$4,$5,'monthly',$6,$6,'bill',false,false)`,[bill.id,scope.workspace,account,bill.amount,bill.note,due]);
  const forecast = await forecastBalances(store,scope,{account,horizon:"30",scenario:"base"},clock);
  assert.equal(forecast.opening,"90.00");
  assert.equal(forecast.projection?.lowestCash,"70.00");
  assert.equal(forecast.projection.cashLowDate,due);
  assert.equal(forecast.projection.days.flatMap(day=>day.events).find(e=>e.label===bill.note)?.source,"Bill estimate");
  const split = {meId:actor.id,reimbursementWorkspace:scope.workspace,otherMembers:[],balances:[],splits:[]};
  const week = weeklyHouseholdCheckIn(scope.workspace,today,split,[bill],[]);
  assert.deepEqual(week?.bills.map(b=>[b.note,b.amount,b.nextDate]),[[bill.note,20,due]]);
  assert.equal(weeklyHouseholdCheckIn(randomUUID(),today,split,[bill],[]),null);
  assert.deepEqual(await ledger(),posted);
  console.log("PASS synthetic setup, capture retry, match/import and receipt, reconciliation, forecast and weekly check-in. Two expenses. Closing CAD 90.00. Projected low CAD 70.00.");
}

async function run() {
  const journal = JSON.parse(await readFile("drizzle/meta/_journal.json","utf8")) as {entries:{tag:string}[]};
  const migrations = await Promise.all(journal.entries.map(e=>readFile("drizzle/"+e.tag+".sql","utf8")));
  if (!process.argv.includes("--hosted")) {
    const local = new PGlite();
    try {
      for (const sql of migrations) await local.exec(sql);
      await exercise(local,embedded(local,{schema}) as unknown as AppDb);
    } finally { await local.close(); }
    return;
  }
  // The operator provisions a new empty database. No existing schema is ever migrated by this command.
  const url = new URL(process.env.PILOT_REHEARSAL_URL ?? "");
  const project = process.env.PILOT_REHEARSAL_PROJECT;
  assert(project && url.hostname.endsWith(".neon.tech") && /^\/m10_rehearsal_[a-f0-9]{32}$/.test(url.pathname));
  const client = new Client({connectionString:url.href});
  await client.connect();
  try {
    await client.query("BEGIN");
    const {rows:[state]} = await client.query("SELECT current_database() AS name,current_setting('neon.project_id') AS project,(SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public') AS tables");
    assert.equal(state.name,url.pathname.slice(1));
    assert.equal(state.project,project);
    assert.equal(state.tables,0,"Use a new empty rehearsal database");
    for (const sql of migrations) await client.query(sql);
    await client.query("COMMIT");
  } finally { await client.end(); }
  await exercise(hostedHouseholdDb(url.href),http(neon(url.href),{schema}));
}

run().catch(error=>{
  console.error((error instanceof Error ? error.message : "Rehearsal failed").replace(/postgres(?:ql)?:\/\/\S+/gi,"[redacted]"));
  process.exitCode=1;
});
