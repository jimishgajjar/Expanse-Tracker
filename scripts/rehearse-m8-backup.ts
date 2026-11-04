/** Exercise the real backup command before debt review, after debt review, and after FX booking.
 * Every database and archive is created beneath this process's disposable directory. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { cpSync,mkdtempSync,readFileSync,rmSync,writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { applyFinance } from "../src/lib/finance-posting";

async function run() {
  const root=mkdtempSync(join(tmpdir(),"m8-synthetic-")),store=join(root,"db"),output=join(root,"encrypted");
  const env={...process.env,DATABASE_URL:"",BACKUP_KEY:randomBytes(32).toString("hex")};
  const cmd=(...args:string[])=>execFileSync(process.execPath,["--import","tsx","scripts/backup-db.ts",...args],{env,stdio:"inherit",windowsHide:true});
  let previous="";
  function snapshot(){
    cmd("--encrypted","--local-path="+store,"--output="+output,...(previous?["--compare-encrypted="+previous]:[]));
    previous=JSON.parse(readFileSync(join(output,"status.json"),"utf8")).file;
    cmd("--verify-encrypted="+previous);
  }
  async function stage(limit:number,exercise:(db:PGlite)=>Promise<void>) {
    const folder=join(root,"migrations-"+limit);
    cpSync("drizzle",folder,{recursive:true});
    const path=join(folder,"meta","_journal.json"),journal=JSON.parse(readFileSync(path,"utf8"));
    journal.entries=journal.entries.filter((e:{idx:number})=>e.idx<=limit);
    writeFileSync(path,JSON.stringify(journal));
    const db=new PGlite(store);
    try {await migrate(drizzle(db),{migrationsFolder:folder});await exercise(db);}finally{await db.close();}
    snapshot();
  }
  try {
    await stage(28,async db=>{
      await db.exec(`INSERT INTO users(id,email,password_hash) VALUES('owner','m8@example.test','unused');
        INSERT INTO workspaces(id,name,owner_id) VALUES('home','Synthetic','owner');
        INSERT INTO workspace_members(workspace_id,user_id,role) VALUES('home','owner','owner');
        INSERT INTO accounts(id,name,workspace_id,initial_balance) VALUES('bank','Cash','home',150),('card','Card','home',25);
        INSERT INTO transactions(id,workspace_id,account_id,type,amount,date) VALUES('old','home','bank','income',1,'2025-01-01');`);
    });
    await stage(29,async db=>{
      await db.exec("INSERT INTO finance_accounts(workspace_id,account_id,role,reviewed_balance,adjustment,interpretation,reviewer) VALUES('home','card','card',25,-50,'owed','owner')");
      await db.exec("INSERT INTO debt_statements VALUES('home','card','2025-01-01','2025-01-31','2025-02-21',25,5)");
    });
    await stage(30,async db=>{
      const s={workspace:"home",actor:"owner"};
      await applyFinance(db,s,{action:"review",account:"bank",role:"cash",currency:"CAD",report:"CAD",expected:"151",interpretation:"signed"});
      await applyFinance(db,s,{action:"review",account:"card",role:"card",currency:"USD",report:"CAD",expected:"25",interpretation:"signed"});
      await applyFinance(db,s,{action:"post",kind:"payment",request:crypto.randomUUID(),account:"bank",amount:"20",destination:"card",
        received:"14",exchange:"0.7",fee:"0.55",interestPaid:"2",source:"Synthetic receipt",asOf:"2025-02-01T12:00:00Z",date:"2025-02-01"});
      await applyFinance(db,s,{action:"quote",currency:"USD",rate:"1.4321098765",source:"Synthetic price",asOf:"2025-03-01T12:00:00Z"});
      assert.equal((await db.query("SELECT amount::text AS amount FROM transactions WHERE id='old'")).rows[0].amount,"1.00");
    });
    await stage(31,async db=>{
      await db.exec("INSERT INTO household_setup(workspace_id,timezone) VALUES('home','America/Toronto'); INSERT INTO opening_cutoffs VALUES('bank','home','2025-01-01',151); INSERT INTO pilot_feedback(id,workspace_id,actor,severity,message) VALUES('feedback','home','owner','suggestion','Synthetic restore check')");
    });
  } finally {rmSync(root,{recursive:true,force:true});}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
