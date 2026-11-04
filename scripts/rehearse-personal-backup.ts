/** Exercise the real encrypted backup/restore command with disposable, synthetic
 * data on both sides of the personal-ledger migration. No source DB arguments. */
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { openPersonalLedger } from "../src/lib/personal-ledger";
import { previewAccountShare, confirmAccountShare } from "../src/lib/account-share-store";
import { reviewReimbursement, settleReimbursement } from "../src/lib/reimbursements";
import { postComment } from "../src/lib/transaction-comments";

async function run() {
  const temporary = realpathSync(tmpdir());
  const root = mkdtempSync(join(temporary,"m7-backup-rehearsal-"));
  const store = join(root,"synthetic-db"), old = join(root,"previous-migrations"), output = join(root,"encrypted");
  const env = {...process.env,DATABASE_URL:"",BACKUP_KEY:randomBytes(32).toString("hex")};
  function backup(...args:string[]) {
    execFileSync(process.execPath,["--import","tsx","scripts/backup-db.ts",...args],{env,stdio:"inherit",windowsHide:true});
  }
  try {
    cpSync("drizzle",old,{recursive:true});
    const journalFile = join(old,"meta","_journal.json");
    const journal = JSON.parse(readFileSync(journalFile,"utf8"));
    journal.entries = journal.entries.filter((e:{idx:number})=>e.idx<23);
    writeFileSync(journalFile,JSON.stringify(journal));
    const before = new PGlite(store);
    try {
      await migrate(drizzle(before),{migrationsFolder:old});
      await before.exec(`INSERT INTO users(id,email,password_hash) VALUES('u','synthetic@example.test','unused'),('peer','peer@example.test','unused');
        INSERT INTO workspaces(id,name,owner_id) VALUES('home','Synthetic household','u');
        INSERT INTO workspace_members(workspace_id,user_id,role) VALUES('home','u','owner'),('home','peer','viewer');
        INSERT INTO accounts(id,workspace_id,name,initial_balance) VALUES('joint','home','Shared',60);
        INSERT INTO transactions(id,workspace_id,account_id,type,date,amount) VALUES('shared-entry','home','joint','expense','2026-11-01',11.25);`);
    } finally { await before.close(); }
    const args=["--encrypted","--local-path="+store,"--output="+output];
    backup(...args);
    const latest=()=>String(JSON.parse(readFileSync(join(output,"status.json"),"utf8")).file);
    const baseline=latest();
    const after=new PGlite(store);
    try {
      await migrate(drizzle(after),{migrationsFolder:"./drizzle"});
      const ledger=await openPersonalLedger(after,{workspace:"home",actor:"u"});
      await after.query("INSERT INTO accounts(id,workspace_id,name) VALUES('personal-account',$1,'Personal')",[ledger]);
      await after.query("INSERT INTO transactions(id,workspace_id,account_id,type,date,amount,created_by) VALUES('personal-entry',$1,'personal-account','income','2026-11-01',14.25,'u')",[ledger]);
      const owner={workspace:ledger,actor:"u",sessionId:"synthetic-rehearsal"};
      const choice={account:"personal-account",recipient:"peer",photos:false};
      const preview=await previewAccountShare(after,owner,choice);
      await confirmAccountShare(after,owner,choice,preview.token,preview.expires);
      const household={workspace:"home",actor:"u"};
      await after.exec("INSERT INTO notification_preferences(workspace_id,user_id,topic,channel) VALUES('home','peer','monthly','email')");
      await after.exec("INSERT INTO invitation_preferences(user_id,channel) VALUES('peer','push')");
      await postComment(after,household,"shared-entry",{requestId:crypto.randomUUID(),body:"Synthetic household comment",mentions:["peer"]});
      await postComment(after,owner,"personal-entry",{requestId:crypto.randomUUID(),body:"Synthetic private comment"});
      await after.exec("INSERT INTO splits(id,workspace_id,creditor_id,debtor_id,amount) VALUES ('iou','home','peer','u',11.25)");
      const settlement=await reviewReimbursement(after,household,"peer");
      await settleReimbursement(after,household,{id:crypto.randomUUID(),peer:"peer",version:settlement.version,payment:{mode:"link",key:"t:shared-entry"}});
    } finally { await after.close(); }
    backup(...args,"--compare-encrypted="+baseline);
    backup("--verify-encrypted="+latest());
    console.log("Shared records preserved. Restored personal ownership, account sharing, a linked reimbursement, comment threads, a mention and notification preferences.");
  } finally {
    const path=realpathSync(root);
    if(dirname(path)===temporary && basename(path).startsWith("m7-backup-rehearsal-")) rmSync(path,{recursive:true,force:true});
  }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
