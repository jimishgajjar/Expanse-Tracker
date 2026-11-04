/** Disposable local PostgreSQL. No host port, credentials, mounted folders or production connection. */
import assert from "node:assert/strict";
import { spawn,execFileSync } from "node:child_process";
import { randomUUID,randomBytes } from "node:crypto";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { PGlite } from "@electric-sql/pglite";
import { postRecurringOccurrences } from "../src/lib/recurring-posting";
import { Inbox } from "../src/lib/plaid-sandbox/inbox";
import type { SandboxProvider } from "../src/lib/plaid-sandbox/provider";
const name="expense-m10-"+randomUUID();
const docker=(args:string[])=>execFileSync("docker",args,{encoding:"utf8",windowsHide:true}).trim();
function statement(body:string):Promise<string> {
  return new Promise((resolve,reject)=>{
    const child=spawn("docker",["exec","-i",name,"psql","-XAtq","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],{windowsHide:true});
    let out="",err="";
    child.stdout.on("data",d=>out+=d);child.stderr.on("data",d=>err+=d);
    child.on("error",reject);child.on("close",code=>code?reject(Error(err.slice(-700))):resolve(out.trim()));child.stdin.end(body);
  });
}
async function main() {
  docker(["run","--pull=never","--rm","-d","--network","none","--name",name,"--tmpfs","/var/lib/postgresql/data","-e","POSTGRES_HOST_AUTH_METHOD=trust","postgres:17-alpine"]);
  const feed=new PGlite();
  try {
    let ready=false;
    for(let i=0;i<60&&!ready;i++) {
      try { ready=(await statement("SELECT 1"))==="1"; } catch {await new Promise(r=>setTimeout(r,400));}
    }
    if (!ready) throw Error("Disposable PostgreSQL did not start.");
    for(const migration of readMigrationFiles({migrationsFolder:"drizzle"})) await statement(migration.sql.join("\n"));
    await statement(`INSERT INTO users(id,email,password_hash) VALUES('u','load@example.test','unused');
      INSERT INTO workspaces(id,owner_id,name) VALUES('w','u','Load rehearsal');
      INSERT INTO accounts(id,workspace_id,name) VALUES('a','w','Synthetic');
      INSERT INTO recurring(id,workspace_id,account_id,type,amount,frequency,next_date) VALUES('r','w','a','expense',5,'monthly','2026-01-01');
      INSERT INTO transactions(id,workspace_id,account_id,type,amount,date,note) SELECT n::text,'w','a','income',1,'2026-01-01','fixture' FROM generate_series(1,100000)n;
      ANALYZE transactions;`);
    // Render only in-process synthetic parameters. The actual recurring claim + insert CTE runs on separate sessions.
    const dialect=new PgDialect();
    const adapter={execute:async(query:SQL)=>{
      const q=dialect.sqlToQuery(query);
      const rendered=q.sql.replace(/\$(\d+)/g,(_,n)=>"'"+String(q.params[Number(n)-1]).replaceAll("'","''")+"'");
      return {rows:[{claimed:(await statement(rendered))==="t"}]};
    }};
    const post=()=>postRecurringOccurrences(adapter as Parameters<typeof postRecurringOccurrences>[0],
      {id:"r",workspaceId:"w",amount:"5.00",frequency:"monthly",autoPost:true,nextDate:"2026-01-01",occurrenceCount:0,tagIds:[]} as Parameters<typeof postRecurringOccurrences>[1],
      "2026-02-01",1,[{workspaceId:"w",accountId:"a",type:"expense",amount:"5",note:"Scheduled",date:"2026-01-01"}]);
    const provider={createLink:async()=>({link_token:"link-sandbox-fixture"}),exchange:async()=>({access_token:"access-sandbox-fixture",item_id:"item"}),
      accounts:async()=>({item:{item_id:"item"},accounts:[{account_id:"test",type:"depository",subtype:"checking"}]}),
      sync:async()=>({added:[{transaction_id:"external",account_id:"test",date:"2026-01-02",name:"Fixture",amount:5,iso_currency_code:"CAD",pending:false,pending_transaction_id:null}],modified:[],removed:[],next_cursor:"done",has_more:false,transactions_update_status:"HISTORICAL_UPDATE_COMPLETE"})};
    const inbox=new Inbox(feed,provider as unknown as SandboxProvider,randomBytes(32));
    const {id}=await inbox.begin("w");
    await inbox.exchange("w",id,"public-sandbox-fixture");await inbox.select("w",id,"test");
    const [first,retry]=await Promise.all([post(),post(),inbox.sync("w",id),statement("UPDATE transactions SET amount=2,note='Edited' WHERE workspace_id='w' AND id='1'"),
      statement("SELECT count(*) FROM transactions WHERE workspace_id='w' AND type='income'")]);
    assert.equal(Number(first)+Number(retry),1);
    assert.equal((await feed.query("SELECT count(*)::int AS count FROM observations")).rows[0].count,1);
    assert.equal(await statement("SELECT count(*),sum(CASE WHEN type='income' THEN amount ELSE -amount END),count(*) FILTER(WHERE note='Edited'),count(*) FILTER(WHERE note='Scheduled') FROM transactions"),"100001|99996.00|1|1");
    console.log("PostgreSQL 17: 100,000 starting entries; independent editor, reader, competing recurrence workers and simulated bank observation. One edit, one scheduled posting, one observation, expected exact final balance.");
  } finally {try {await feed.close();} finally {docker(["stop",name]);}}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
