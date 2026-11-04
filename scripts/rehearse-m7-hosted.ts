/** No .env loading or application connection fallback. Only a newly created synthetic DB in an empty test project. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { Client } from "@neondatabase/serverless";
import { hostedHouseholdDb } from "../src/lib/household-db";
import { openPersonalLedger } from "../src/lib/personal-ledger";
import { confirmAccountShare, previewAccountShare, receivedReport, receivedShares } from "../src/lib/account-share-store";
import { postComment, readComments } from "../src/lib/transaction-comments";
import { reviewReimbursement, settleReimbursement } from "../src/lib/reimbursements";

async function run() {
  const url = new URL(process.env.M7_REHEARSAL_URL ?? "");
  const project = process.env.M7_REHEARSAL_PROJECT;
  assert(project && url.hostname.endsWith(".neon.tech") && url.pathname === "/neondb","Dedicated test project required");
  const control = new Client({connectionString:url.href});
  const name = "m7_rehearsal_" + randomUUID().replaceAll("-","");
  await control.connect();
  try {
    const {rows:[state]} = await control.query("SELECT current_setting('neon.project_id') AS project,(SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public') AS tables");
    assert.equal(state.project,project);
    assert.equal(state.tables,0,"Refusing a nonempty control database");
    await control.query("CREATE DATABASE " + name);
  } finally { await control.end(); }
  url.pathname = "/" + name;
  const setup = new Client({connectionString:url.href});
  await setup.connect();
  try {
    const {rows:[state]} = await setup.query("SELECT current_database() AS db, current_setting('neon.project_id') AS project");
    assert.equal(state.db,name); assert.equal(state.project,project);
    // This rehearsal represents the M7 release, including when M8 migrations exist locally.
    const files = readdirSync("drizzle").filter(f=>/^\d{4}_.*\.sql$/.test(f) && f<"0029_").sort();
    assert.equal(files.at(-1),"0028_direct_notifications.sql","Expected the complete M7 migration set");
    const migrate = async (file:string) => { await setup.query(readFileSync("drizzle/"+file,"utf8")); };
    for (const file of files.filter(f=>f < "0023_")) await migrate(file);
    await setup.query(`INSERT INTO users(id,email,password_hash,email_verified_at)
      SELECT u,u||'@example.invalid','disabled',now() FROM unnest(ARRAY['owner','member','viewer','other']) u;
      INSERT INTO workspaces(id,owner_id,name) VALUES('home','owner','Household A'),('away','other','Household B');
      INSERT INTO workspace_members(workspace_id,user_id,role) VALUES('home','owner','owner'),('home','member','member'),('home','viewer','viewer'),('away','other','owner');
      INSERT INTO accounts(id,workspace_id,name,initial_balance) VALUES('shared','home','Joint account',100),('foreign','away','Other household',500);
      INSERT INTO transactions(id,workspace_id,type,amount,date,account_id) VALUES('rent','home','expense',12,'2026-11-01','shared');
      INSERT INTO splits(id,workspace_id,creditor_id,debtor_id,amount) VALUES('iou','home','member','owner',12);`);
    const baseline = () => setup.query("SELECT (SELECT to_jsonb(t) FROM transactions t WHERE id='rent') AS entry,(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM accounts a WHERE id IN ('shared','foreign')) AS accounts");
    const before = (await baseline()).rows;
    for (const file of files.filter(f=>f >= "0023_")) await migrate(file);
    assert.deepEqual((await baseline()).rows,before);
    const db = hostedHouseholdDb(url.href);
    const home = {workspace:"home",actor:"owner",sessionId:randomUUID()};
    const member = {...home,actor:"member",sessionId:randomUUID()};
    const viewer = {...home,actor:"viewer",sessionId:randomUUID()};
    const outsider = {...viewer,workspace:"away",actor:"other"};
    const [privateId,retry] = await Promise.all([openPersonalLedger(db,member),openPersonalLedger(db,member)]);
    assert.equal(privateId,retry);
    const privateScope = {...member,workspace:privateId};
    await setup.query("INSERT INTO accounts(id,workspace_id,name,initial_balance) VALUES ('personal',$1,'PRIVATE-M7-FIXTURE',741)",[privateId]);
    const choice={account:"personal",recipient:"viewer",photos:false};
    const preview=await previewAccountShare(db,privateScope,choice);
    await confirmAccountShare(db,privateScope,choice,preview.token,preview.expires);
    const [copy]=await receivedShares(db,viewer);
    assert.equal((await receivedReport(db,viewer,copy.id)).report.balance,"741.00");
    await assert.rejects(receivedReport(db,outsider,copy.id));
    const post={requestId:randomUUID(),body:"Synthetic mention",mentions:["viewer"]};
    const results=await Promise.all([postComment(db,member,"rent",post),postComment(db,member,"rent",post)]);
    assert.equal(results.filter(r=>r.created).length,1);
    assert.equal((await readComments(db,viewer,"rent")).rows.length,1);
    await assert.rejects(readComments(db,outsider,"rent"));
    const review = await reviewReimbursement(db,home,"member");
    await settleReimbursement(db,home,{id:randomUUID(),peer:"member",version:review.version,payment:{mode:"link",key:"t:rent"}});
    await setup.query("DELETE FROM workspace_members WHERE workspace_id='home' AND user_id='viewer'");
    await assert.rejects(receivedReport(db,viewer,copy.id));
    await assert.rejects(readComments(db,viewer,"rent"));
    assert.deepEqual((await baseline()).rows,before);
    console.log("PASS: hosted M7 migrations, concurrent private-ledger creation and comment replay, named sharing, settlement, revocation and original financial records.");
    console.log("Synthetic database for the device rehearsal:",name);
  } finally { await setup.end(); }
}

run().catch(error => { console.error("Hosted M7 rehearsal failed:",error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/gi,"[redacted]") : "unknown error"); process.exitCode=1; });
