/** Hosted M2 rehearsal. Never reads .env or DATABASE_URL. Only uses a new,
 * uniquely named database inside the explicitly identified EMPTY Neon project. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { Client, neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/lib/db/schema";
import { stageBatch, approveBatch, loadBatch } from "../src/lib/file-import-store";
import { parseSource } from "../src/lib/file-import-parser";
import { defaultMapping } from "../src/lib/file-import-model";
import { startStatementReview, recordStatementCorrection } from "../src/lib/statement-review-store";

async function main() {
  const target=new URL(process.env.M2_REHEARSAL_URL??"");
  const expected=process.env.M2_REHEARSAL_PROJECT;
  assert(expected && target.hostname.endsWith(".neon.tech") && target.pathname==="/neondb","Explicit disposable Neon target required");
  neonConfig.webSocketConstructor=WebSocket;
  const project=new Client({connectionString:target.href});
  const name="m2_rehearsal_"+randomUUID().replaceAll("-","");
  await project.connect();
  try {
    const {rows:[info]}=await project.query("SELECT current_setting('neon.project_id') AS project, (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public') AS tables");
    assert.equal(info.project,expected);assert.equal(info.tables,0,"Refusing nonempty control database");
    await project.query("CREATE DATABASE "+name);
  } finally {await project.end();}
  target.pathname="/"+name;
  const setup=new Client({connectionString:target.href});
  await setup.connect();
  try {
    const {rows:[info]}=await setup.query("SELECT current_database() AS db,current_setting('neon.project_id') AS project");
    assert.equal(info.db,name);assert.equal(info.project,expected);
    const files=readdirSync("drizzle").filter(f=>/^\d{4}_.*\.sql$/.test(f)).sort();
    assert.equal(files.at(-1),"0013_file_imports.sql","Review rehearsal before using later migrations");
    const apply=async(file:string)=>{await setup.query(readFileSync("drizzle/"+file,"utf8"));};
    for(const file of files.slice(0,-2))await apply(file);
    await setup.query("INSERT INTO users(id,email,password_hash) VALUES('a','a@example.invalid','x'),('b','b@example.invalid','x'); INSERT INTO workspaces(id,name,owner_id) VALUES('w','Synthetic','a'); INSERT INTO workspace_members(workspace_id,user_id,role) VALUES('w','a','owner'),('w','b','member'); INSERT INTO accounts(id,workspace_id,name,initial_balance) VALUES('bank','w','Bank',100),('cash','w','Cash',100); INSERT INTO app_settings(workspace_id,currency_code) VALUES('w','CAD'); INSERT INTO transactions(id,workspace_id,account_id,type,date,amount,note) VALUES('original','w','bank','expense','2026-10-01',7.89,'Original fixture');");
    const baseline=async()=>(await setup.query("SELECT to_jsonb(t) AS original,(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM accounts a) AS accounts FROM transactions t WHERE t.id='original'")).rows;
    const before=await baseline();assert.equal(before.length,1);
    for(const file of files.slice(-2))await apply(file);
    assert.deepEqual(await baseline(),before);
    console.log("PASS: additive M2 migrations preserved the original expense and both accounts.");
    const api=neon(target.href),db=drizzle(api,{schema}),scope={workspace:"w",actor:"a",name:"Synthetic A"};
    const counts=async()=>(await api.query("SELECT (SELECT count(*)::int FROM transactions) AS tx,(SELECT count(*)::int FROM transaction_history) AS history"))[0];
    async function race<T>(table:"file_imports"|"reconciliation_sessions",a:()=>Promise<T>,b:()=>Promise<T>){
      await setup.query("BEGIN");
      let joined:Promise<PromiseSettledResult<T>[]>|undefined;
      try{
        await setup.query("LOCK TABLE "+table+" IN SHARE MODE");
        joined=Promise.allSettled([a(),b()]);
        const deadline=Date.now()+20000;
        for(;;){
          const [r]=await api.query("SELECT count(DISTINCT pid)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND state='active' AND wait_event_type='Lock'");
          if(r.n===2)break;
          assert(Date.now()<deadline,"Did not observe two concurrent blocked writer sessions");
          await delay(100);
        }
      }finally{await setup.query("ROLLBACK");}
      return joined!;
    }
    async function stage(rows:string){
      const src=await parseSource(new File(["Date,Amount,Note\n"+rows],"fixture.csv"));
      return stageBatch(db,scope,src,{...defaultMapping(src.headers),fallback:"bank"},"CAD");
    }
    const batch=await stage("2026-10-02,-1.25,Sample fee\n2026-10-03,2.50,Sample refund");
    const approve=(actor:string)=>approveBatch(db,{...scope,actor},batch.id,batch.version,{"2":"import","3":"import"});
    const imported=await race("file_imports",()=>approve("a"),()=>approve("b"));
    assert(imported.every(r=>r.status==="fulfilled"),"Both callers must see the committed receipt");
    const receipt=imported[0].value.receipt;
    assert.equal(receipt?.length,2);assert.deepEqual(imported[1].value.receipt,receipt);
    assert.deepEqual((await approve("a")).receipt,receipt); // retry after discarding first response
    assert.deepEqual(await counts(),{tx:3,history:2});
    const links=await api.query("SELECT t.id,t.amount::text AS amount,t.type::text AS type FROM transactions t JOIN transaction_history h ON h.transaction_id=t.id AND h.workspace_id=t.workspace_id ORDER BY t.date");
    assert.deepEqual(links.map(r=>[r.id,r.amount,r.type]),[[receipt![0].transactionId,"1.25","expense"],[receipt![1].transactionId,"2.50","income"]]);
    console.log("PASS: two concurrent import approvals and retry produced one receipt and exactly two audited entries.");
    const actor={id:"a",name:"Synthetic A"},reviewId=randomUUID();
    await startStatementReview(db,"w",actor,{id:reviewId,accountId:"cash",start:"2026-10-01",end:"2026-10-31",closingBalance:"97"});
    const attempts=["a","b"].map(id=>{
      const input={id:reviewId,version:1,requestId:randomUUID(),date:"2026-10-04",type:"expense",amount:"3",description:"Sample fee",reason:"Synthetic statement fee",verified:true,separatePurchase:false};
      return ()=>recordStatementCorrection(db,"w",{id,name:"Synthetic "+id},input);
    });
    const corrected=await race("reconciliation_sessions",attempts[0],attempts[1]);
    const winner=corrected.findIndex(r=>r.status==="fulfilled");
    assert(winner>=0&&corrected.filter(r=>r.status==="fulfilled").length===1,"Exactly one correction must win");
    assert.equal((await attempts[winner]()).effectiveStatus,"needs_review");
    assert.deepEqual(await counts(),{tx:4,history:3});
    const [events]=await api.query("SELECT count(*)::int AS n FROM reconciliation_sessions s,jsonb_array_elements(s.events) e WHERE e->>'event'='correction'");
    assert.equal(events.n,1);
    console.log("PASS: two concurrent corrections and a replay recorded one expense, one creation history and one statement event.");
    const bad=await stage("2026-10-09,-1,First row\n2026-10-10,-2,Rejected fixture");
    await setup.query("ALTER TABLE transactions ADD CONSTRAINT synthetic_failure CHECK (note <> 'Rejected fixture')");
    await assert.rejects(approveBatch(db,scope,bad.id,bad.version,{"2":"import","3":"import"}));
    assert.equal((await loadBatch(db,scope,bad.id)).receipt,null);
    assert.deepEqual(await counts(),{tx:4,history:3});
    await setup.query("ALTER TABLE transactions DROP CONSTRAINT synthetic_failure");
    assert.equal((await approveBatch(db,scope,bad.id,bad.version,{"2":"import","3":"import"})).receipt?.length,2);
    assert.deepEqual(await counts(),{tx:6,history:5});
    assert.deepEqual(await baseline(),before);
    console.log("PASS: rejected second row rolled back the batch, receipt and history. Baseline unchanged.");
  }finally{await setup.end();}
}
main().catch(e=>{
  // Do not log URLs, SQL parameters or credentials on failure.
  console.error("Hosted rehearsal failed:",e instanceof assert.AssertionError?e.message:e?.cause?.code??e?.code??e?.name??"unknown");
  process.exitCode=1;
});
