import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { PgDialect } from "drizzle-orm/pg-core";
import type { AppDb } from "../db";
import { analyseStatement, decimalMoney, moneyCents, statementInput, type StatementReview } from "../statement-review";
import { listStatementReviews, readStatementReview, saveStatementReview, startStatementReview, recordStatementCorrection } from "../statement-review-store";
import { backupMigrationsForTables } from "../../../scripts/backup-migrations";

let client:PGlite, db:AppDb;
const actor={id:"owner",name:"Test owner"};
const input=(patch={})=>({id:randomUUID(),accountId:"bank",start:"2026-10-01",end:"2026-10-31",closingBalance:"55.00",...patch});
async function start(patch={}) {const id=await startStatementReview(db,"home",actor,input(patch));return readStatementReview(db,"home",actor.id,id);}
const choices=(review:StatementReview)=>Object.fromEntries(review.snapshot.entries.filter(entry=>entry.date>=review.start).map(entry=>[entry.id,"cleared" as const]));
const save=(review:StatementReview,patch={})=>saveStatementReview(db,"home",actor,{id:review.id,version:review.version,decisions:choices(review),duplicatesReviewed:true,complete:true,...patch});

beforeAll(async()=>{
  client=new PGlite();const local=drizzle(client);await migrate(local,{migrationsFolder:"./drizzle"});db=local as unknown as AppDb;
},60000);
beforeEach(async()=>{
  await client.exec(`TRUNCATE users,workspaces CASCADE;
    INSERT INTO users(id,email,password_hash) VALUES ('owner','owner@example.test','x'),('viewer','viewer@example.test','x'),('outsider','outsider@example.test','x');
    INSERT INTO workspaces(id,name,owner_id) VALUES ('home','Home','owner'),('other','Other','outsider');
    INSERT INTO workspace_members(workspace_id,user_id,role) VALUES ('home','owner','owner'),('home','viewer','viewer'),('other','outsider','owner');
    INSERT INTO accounts(id,workspace_id,name,initial_balance) VALUES ('bank','home','Bank',100),('cash','home','Cash',0),('private','other','Private',999);
    INSERT INTO transactions(id,workspace_id,type,amount,date,account_id,note) VALUES
      ('prior','home','expense',10,'2026-09-30','bank','Before statement'),
      ('coffee','home','expense',10,'2026-10-01','bank','Coffee'),
      ('duplicate','home','expense',10,'2026-10-01','bank','Coffee'),
      ('refund','home','income',5,'2026-10-02','bank','Refund');
    INSERT INTO transfers(id,workspace_id,from_account_id,to_account_id,amount,date) VALUES ('transfer','home','bank','cash',20,'2026-10-03');`);
});
afterAll(async()=>{await client?.close();});

describe("saved statement reviews",()=>{
  it("captures the opening balance, refund and transfer without changing the ledger",async()=>{
    const review=await start();const analysis=analyseStatement(review.snapshot,review.start,review.end,review.closingBalance,{},false);
    expect(analysis).toMatchObject({opening:"90.00",ledgerClosing:"55.00",unreviewed:4,canComplete:false});
    expect(analysis.duplicateIds).toEqual(["tx:coffee","tx:duplicate"]);
    expect((await client.query("SELECT count(*)::int AS n FROM transactions")).rows[0]).toEqual({n:4});
    expect((await client.query("SELECT count(*)::int AS n FROM transfers")).rows[0]).toEqual({n:1});
  });
  it("retains one draft across a repeated start and rejects different details on that identity",async()=>{
    const value=input();await startStatementReview(db,"home",actor,value);await startStatementReview(db,"home",actor,value);
    await expect(startStatementReview(db,"home",actor,{...value,closingBalance:"99"})).rejects.toThrow("Unable to start");
    expect(await listStatementReviews(db,"home",actor.id,"bank")).toHaveLength(1);
  });
  it("requires review of every entry and explicit duplicate acknowledgement",async()=>{
    const review=await start();
    await expect(save(review,{decisions:{}})).rejects.toThrow("review every entry");
    await expect(save(review,{duplicatesReviewed:false})).rejects.toThrow("acknowledge possible duplicates");
    const complete=await save(review);expect(complete.effectiveStatus).toBe("completed");
    expect(complete.version).toBe(2);expect(complete.completedAt).not.toBeNull();
    expect((await client.query<{events:unknown[]}>("SELECT events FROM reconciliation_sessions")).rows[0].events).toHaveLength(2);
    await expect(save(complete)).rejects.toThrow("already completed");
  });
  it("keeps a missing fee and duplicate visible until explicitly corrected",async()=>{
    const original=await start({closingBalance:"62.00"});
    await expect(save(original)).rejects.toThrow("exact difference");
    await client.exec(`DELETE FROM transactions WHERE id='duplicate'; INSERT INTO transactions(id,workspace_id,type,amount,date,account_id,note) VALUES ('fee','home','expense',3,'2026-10-04','bank','Verified statement fee');`);
    expect((await readStatementReview(db,"home",actor.id,original.id)).effectiveStatus).toBe("needs_review");
    const corrected=await start({closingBalance:"62.00"});expect((await save(corrected)).effectiveStatus).toBe("completed");
    expect((await client.query("SELECT count(*)::int AS n FROM transactions")).rows[0]).toEqual({n:4});
  });
  it("explains outstanding payments without manufacturing an adjustment",async()=>{
    const review=await start({closingBalance:"75"});
    const decisions={...choices(review),"transfer:transfer":"outstanding" as const};
    const analysis=analyseStatement(review.snapshot,review.start,review.end,review.closingBalance,decisions,true);
    expect(analysis).toMatchObject({clearedClosing:"75.00",ledgerClosing:"55.00",outstanding:"-20.00",difference:"0.00",canComplete:true});
    expect((await save(review,{decisions})).effectiveStatus).toBe("completed");
  });
  it.each([
    ["amount", "UPDATE transactions SET amount=11 WHERE id='coffee'"],
    ["date", "UPDATE transactions SET date='2026-11-01' WHERE id='coffee'"],
    ["account", "UPDATE transactions SET account_id='cash' WHERE id='coffee'"],
    ["type", "UPDATE transactions SET type='income' WHERE id='coffee'"],
    ["note", "UPDATE transactions SET note='Corrected details' WHERE id='coffee'"],
    ["deletion", "DELETE FROM transactions WHERE id='coffee'"],
    ["opening balance", "UPDATE accounts SET initial_balance=101 WHERE id='bank'"],
    ["earlier entry", "UPDATE transactions SET amount=11 WHERE id='prior'"],
    ["transfer", "UPDATE transfers SET amount=21 WHERE id='transfer'"],
    ["currency", "INSERT INTO app_settings(workspace_id,currency_code) VALUES ('home','CAD')"],
    ["new entry", "INSERT INTO transactions(id,workspace_id,type,amount,date,account_id) VALUES ('new','home','expense',1,'2026-10-30','bank')"],
    ["deleted account", "DELETE FROM accounts WHERE id='bank'"],
  ])("flags a completed review after %s changes",async(_name,mutation)=>{
    const completed=await save(await start());await client.exec(mutation);
    const changed=await readStatementReview(db,"home",actor.id,completed.id);
    expect(changed.status).toBe("completed");expect(changed.effectiveStatus).toBe("needs_review");expect(changed.changes.length).toBeGreaterThan(0);
    expect(changed.snapshot).toEqual(completed.snapshot);
  });
  it("ignores later activity outside the closing date",async()=>{
    const completed=await save(await start());
    await client.exec("INSERT INTO transactions(id,workspace_id,type,amount,date,account_id) VALUES ('later','home','expense',500,'2026-11-01','bank')");
    expect((await readStatementReview(db,"home",actor.id,completed.id)).effectiveStatus).toBe("completed");
  });
  it("rejects foreign accounts, unauthorized readers, viewers and foreign entry choices",async()=>{
    await expect(start({accountId:"private"})).rejects.toThrow("Unable to start");
    await expect(startStatementReview(db,"home",{id:"viewer",name:"Viewer"},input())).rejects.toThrow("Unable to start");
    const review=await start();expect((await readStatementReview(db,"home","viewer",review.id)).id).toBe(review.id);
    await expect(readStatementReview(db,"other","outsider",review.id)).rejects.toThrow("not found");
    await expect(readStatementReview(db,"home","outsider",review.id)).rejects.toThrow("not found");
    await expect(save(review,{decisions:{"tx:foreign":"cleared"},complete:false})).rejects.toThrow("outside its statement period");
    await expect(saveStatementReview(db,"home",{id:"viewer",name:"Viewer"},{id:review.id,version:1,decisions:{},duplicatesReviewed:false,complete:false})).rejects.toThrow("access was removed");
  });
  it("rejects competing updates with stale versions instead of losing another reviewer's changes",async()=>{
    const review=await start();const results=await Promise.allSettled([save(review,{complete:false}),save(review,{complete:false})]);
    expect(results.filter(result=>result.status==="fulfilled")).toHaveLength(1);
    expect((await readStatementReview(db,"home",actor.id,review.id)).version).toBe(2);
  });
  it.each(["ledger","permission"])("rechecks %s in the final write statement",async(mode)=>{
    const review=await start();const dialect=new PgDialect();
    const raced={execute:async(query:Parameters<AppDb["execute"]>[0])=>{
      const compiled=dialect.sqlToQuery(query as Parameters<typeof dialect.sqlToQuery>[0]);
      if(compiled.sql.includes("UPDATE reconciliation_sessions")) await client.exec(mode==="ledger"?"UPDATE accounts SET initial_balance=101 WHERE id='bank'":"UPDATE workspace_members SET role='viewer' WHERE workspace_id='home' AND user_id='owner'");
      return db.execute(query);
    }} as unknown as AppDb;
    await expect(saveStatementReview(raced,"home",actor,{id:review.id,version:1,decisions:choices(review),duplicatesReviewed:true,complete:true})).rejects.toThrow("changed");
    expect((await client.query("SELECT status,version FROM reconciliation_sessions")).rows[0]).toEqual({status:"draft",version:1});
  });
});

it("uses exact signed cents and rejects ambiguous dates or rounded balances",()=>{
  expect(decimalMoney(moneyCents("-0.01"))).toBe("-0.01");
  expect(decimalMoney(moneyCents("9999999999999999.99")+BigInt(1))).toBe("10000000000000000.00");
  for(const patch of [{start:"2026-02-30"},{start:"2026-11-01"},{closingBalance:"12.345"},{closingBalance:"1e3"},{closingBalance:"$12"}]) expect(statementInput.safeParse(input(patch)).success).toBe(false);
});

it("selects the old migration journal for pre-release backups, retaining the new schema when installed",()=>{
  const old=backupMigrationsForTables("./drizzle",["accounts","transactions"]);
  const journal=JSON.parse(readFileSync(join(old,"meta/_journal.json"),"utf8"));
  expect(journal.entries.at(-1).tag).toBe("0011_transaction_history");
  const middle=backupMigrationsForTables("./drizzle",["reconciliation_sessions"]);
  expect(JSON.parse(readFileSync(join(middle,"meta/_journal.json"),"utf8")).entries.at(-1).tag).toBe("0012_statement_reviews");
  const released=backupMigrationsForTables("./drizzle",["reconciliation_sessions","file_imports"]);
  expect(JSON.parse(readFileSync(join(released,"meta/_journal.json"),"utf8")).entries.at(-1).tag).toBe("0013_file_imports");
  const rules=backupMigrationsForTables("./drizzle",["reconciliation_sessions","file_imports","merchant_rule_versions"]);
  expect(JSON.parse(readFileSync(join(rules,"meta/_journal.json"),"utf8")).entries.at(-1).tag).toBe("0014_merchant_rules");
  const allocations=["reconciliation_sessions","file_imports","merchant_rule_versions","purchase_allocations"];
  const previous=backupMigrationsForTables("./drizzle",allocations);
  expect(JSON.parse(readFileSync(join(previous,"meta/_journal.json"),"utf8")).entries.at(-1).tag).toBe("0015_purchase_allocations");
  const receipts=[...allocations,"receipt_images","capture_drafts"];
  const prior=backupMigrationsForTables("./drizzle",receipts);
  expect(JSON.parse(readFileSync(join(prior,"meta/_journal.json"),"utf8")).entries.at(-1).tag).toBe("0016_receipts_and_drafts");
  const monthly=[...receipts,"monthly_plans","goal_reservations"];
  expect(JSON.parse(readFileSync(join(backupMigrationsForTables("./drizzle",monthly),"meta/_journal.json"),"utf8")).entries.at(-1).tag).toBe("0017_monthly_planning");
  const payday=[...monthly,"pay_period_plans","annual_goal_plans"];
  expect(JSON.parse(readFileSync(join(backupMigrationsForTables("./drizzle",payday),"meta/_journal.json"),"utf8")).entries.at(-1).tag).toBe("0018_pay_periods_and_annual_funds");
  const refunds=[...payday,"refund_links"];
  expect(JSON.parse(readFileSync(join(backupMigrationsForTables("./drizzle",refunds),"meta/_journal.json"),"utf8")).entries.at(-1).tag).toBe("0019_linked_refunds");
  const moves=[...refunds,"budget_moves"];
  expect(JSON.parse(readFileSync(join(backupMigrationsForTables("./drizzle",moves),"meta/_journal.json"),"utf8")).entries.at(-1).tag).toBe("0020_budget_moves");
  const reviews=[...moves,"goal_opening_reviews"];
  expect(JSON.parse(readFileSync(join(backupMigrationsForTables("./drizzle",reviews),"meta/_journal.json"),"utf8")).entries.at(-1).tag).toBe("0021_goal_opening_reviews");
  const scenarios=[...reviews,"forecast_scenarios"];
  expect(JSON.parse(readFileSync(join(backupMigrationsForTables("./drizzle",scenarios),"meta/_journal.json"),"utf8")).entries.at(-1).tag).toBe("0022_forecast_scenarios");
  const personal=[...scenarios,"personal_ledgers"];
  expect(JSON.parse(readFileSync(join(backupMigrationsForTables("./drizzle",personal),"meta/_journal.json"),"utf8")).entries.at(-1).tag).toBe("0023_personal_ledgers");
  const sharing=[...personal,"account_shares"];
  expect(JSON.parse(readFileSync(join(backupMigrationsForTables("./drizzle",sharing),"meta/_journal.json"),"utf8")).entries.at(-1).tag).toBe("0024_account_shares");
  const settled=[...sharing,"reimbursements"];
  expect(JSON.parse(readFileSync(join(backupMigrationsForTables("./drizzle",settled),"meta/_journal.json"),"utf8")).entries.at(-1).tag).toBe("0025_reimbursements");
  const comments=[...settled,"transaction_comments"];
  expect(JSON.parse(readFileSync(join(backupMigrationsForTables("./drizzle",comments),"meta/_journal.json"),"utf8")).entries.at(-1).tag).toBe("0026_transaction_comments");
  const preferences=[...comments,"notification_preferences"];
  expect(JSON.parse(readFileSync(join(backupMigrationsForTables("./drizzle",preferences),"meta/_journal.json"),"utf8")).entries.at(-1).tag).toBe("0027_notification_preferences");
  const direct=[...preferences,"invitation_preferences","comment_mentions"];
  expect(JSON.parse(readFileSync(join(backupMigrationsForTables("./drizzle",direct),"meta/_journal.json"),"utf8")).entries.at(-1).tag).toBe("0028_direct_notifications");
  const debt=[...direct,"finance_accounts","debt_statements","loan_terms"];
  expect(JSON.parse(readFileSync(join(backupMigrationsForTables("./drizzle",debt),"meta/_journal.json"),"utf8")).entries.at(-1).tag).toBe("0029_debt_reviews");
  const finance=[...debt,"finance_books","account_denominations","valuation_quotes","finance_operations","finance_bookings"];
  expect(JSON.parse(readFileSync(join(backupMigrationsForTables("./drizzle",finance),"meta/_journal.json"),"utf8")).entries.at(-1).tag).toBe("0030_booked_currencies");
  expect(()=>backupMigrationsForTables("./drizzle",[...finance,"opening_cutoffs"])).toThrow(/Incomplete/);
  expect(backupMigrationsForTables("./drizzle",[...finance,"household_setup","opening_cutoffs","pilot_feedback"])).toBe("./drizzle");
},30000);

describe("investigating and correcting statement discrepancies",()=>{
  const missing=async()=>save(await start({closingBalance:"52.00"}),{complete:false});
  const correction=(r:StatementReview)=>({id:r.id,version:r.version,requestId:randomUUID(),date:"2026-10-15",
    amount:"3",type:"expense",description:"Paper statement fee",reason:"Fee on October statement, page 2",verified:true,separatePurchase:false});
  it("posts only the verified fee, retains the reason in both histories and requires a new review",async()=>{
    const draft=await missing(),value=correction(draft);
    const updated=await recordStatementCorrection(db,"home",actor,value);
    expect(updated.effectiveStatus).toBe("needs_review");
    expect(updated.entryChanges).toMatchObject([{before:null,after:{date:value.date,delta:"-3.00",note:"Statement correction · Paper statement fee"}}]);
    expect(updated.snapshot).toEqual(draft.snapshot);
    const replay=await recordStatementCorrection(db,"home",actor,value);
    expect(replay.version).toBe(updated.version);
    const audits=await client.query<{transaction_id:string,after:{_creation:object}}>("SELECT transaction_id,\"after\" FROM transaction_history");
    expect(audits.rows).toHaveLength(1);
    expect(audits.rows[0].after._creation).toMatchObject({source:"statement_correction",reason:value.reason,reviewId:draft.id});
    const events=await client.query<{events:{event:string,transactionId?:string,reason?:string}[]}>("SELECT events FROM reconciliation_sessions WHERE id=$1",[draft.id]);
    expect(events.rows[0].events.at(-1)).toMatchObject({event:"correction",transactionId:audits.rows[0].transaction_id,reason:value.reason});
    const fresh=await save(await start({closingBalance:"52.00"}));
    expect(fresh.effectiveStatus).toBe("completed");
    await client.query("DELETE FROM transactions WHERE id=$1",[audits.rows[0].transaction_id]);
    await expect(recordStatementCorrection(db,"home",actor,value)).rejects.toThrow("later removed");
    expect((await readStatementReview(db,"home",actor.id,draft.id)).effectiveStatus).toBe("needs_review");
    expect((await client.query("SELECT count(*)::int n FROM transactions")).rows[0]).toEqual({n:4});
  });
  it.each(["no difference","unreviewed","duplicate","not verified","no reason","bad date","stale","changed ledger","viewer","archived","foreign"])("rejects %s without posting or recording an adjustment",async mode=>{
    const r=mode==="no difference"?await save(await start(),{complete:false}):mode==="unreviewed"?await start({closingBalance:"52"}):await missing();
    const value=correction(r);let scope="home",who=actor;
    if(mode==="duplicate"){value.date="2026-10-01";value.amount="10";}
    if(mode==="not verified")value.verified=false;
    if(mode==="no reason")value.reason=" ";
    if(mode==="bad date")value.date="2026-11-01";
    if(mode==="stale")value.version++;
    if(mode==="changed ledger")await client.exec("UPDATE transactions SET amount=6 WHERE id='refund'");
    if(mode==="viewer")who={id:"viewer",name:"Viewer"};
    if(mode==="archived")await client.exec("UPDATE accounts SET archived=true WHERE id='bank'");
    if(mode==="foreign"){scope="other";who={id:"outsider",name:"Private"};}
    await expect(recordStatementCorrection(db,scope,who,value)).rejects.toThrow();
    expect((await client.query("SELECT count(*)::int n FROM transactions")).rows[0]).toEqual({n:4});
    expect((await client.query("SELECT count(*)::int n FROM transaction_history")).rows[0]).toEqual({n:0});
    expect((await readStatementReview(db,"home",actor.id,r.id)).version).toBe(r.version);
  });
  it("rejects a second editor's correction against the same snapshot",async()=>{
    const r=await missing();
    const values=[correction(r),correction(r)];
    const attempts=await Promise.allSettled(values.map(v=>recordStatementCorrection(db,"home",actor,v)));
    expect(attempts.filter(a=>a.status==="fulfilled")).toHaveLength(1);
    expect((await client.query("SELECT count(*)::int n FROM transactions")).rows[0]).toEqual({n:5});
  });
  it("shows the actual before and after for edits and does not guess where a removed entry went",async()=>{
    const r=await start();
    await client.exec("UPDATE transactions SET amount=8,note='Corrected refund' WHERE id='refund'; UPDATE transactions SET account_id='cash' WHERE id='coffee'");
    const updated=await readStatementReview(db,"home",actor.id,r.id);
    expect(updated.entryChanges).toMatchObject([{before:{id:"tx:refund",delta:"5.00"},after:{id:"tx:refund",delta:"8.00",note:"Corrected refund"}},{before:{id:"tx:coffee"},after:null}]);
  });
});

it("records the actual refund even when it does not explain the whole difference",async()=>{
  const r=await save(await start({closingBalance:"62"}),{complete:false});
  const updated=await recordStatementCorrection(db,"home",actor,{id:r.id,version:r.version,requestId:randomUUID(),type:"income",date:"2026-10-02",description:"Second refund",amount:"5.00",reason:"Separate receipt on the statement",verified:true,separatePurchase:true});
  expect(updated.entryChanges).toMatchObject([{after:{delta:"5.00",kind:"income"}}]);
  const fresh=await start({closingBalance:"62"});
  expect(analyseStatement(fresh.snapshot,fresh.start,fresh.end,fresh.closingBalance,choices(fresh),true)).toMatchObject({difference:"2.00",canComplete:false});
});

it("rolls back both audit records when the ledger insert fails",async()=>{
  const r=await save(await start({closingBalance:"52"}),{complete:false});
  await client.exec("CREATE FUNCTION fail_test_correction() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic ledger rejection'; END $$; CREATE TRIGGER fail_test_correction BEFORE INSERT ON transactions FOR EACH ROW EXECUTE FUNCTION fail_test_correction()");
  try{
    await expect(recordStatementCorrection(db,"home",actor,{id:r.id,version:r.version,requestId:randomUUID(),type:"expense",date:"2026-10-15",description:"Fee",amount:"3",reason:"Verified fee on statement",verified:true,separatePurchase:false})).rejects.toThrow();
    const check=await readStatementReview(db,"home",actor.id,r.id);
    expect(check).toMatchObject({version:r.version,effectiveStatus:"draft",changes:[]});
    expect((await client.query("SELECT count(*)::int n FROM transaction_history")).rows[0]).toEqual({n:0});
  }finally{await client.exec("DROP TRIGGER fail_test_correction ON transactions; DROP FUNCTION fail_test_correction()");}
});
