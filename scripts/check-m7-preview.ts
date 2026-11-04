/** Check an exact protected Vercel preview against a disposable M7 database. No application .env is loaded. */
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";
import sharp from "sharp";
import { Client } from "@neondatabase/serverless";
import { hostedHouseholdDb } from "../src/lib/household-db";
import { forecastBalances } from "../src/lib/balance-forecast";
import { previewAccountShare,confirmAccountShare,receivedShares } from "../src/lib/account-share-store";

const execute = promisify(execFile);
async function check() {
  const target = new URL(process.env.M7_REHEARSAL_URL ?? "");
  const origin = new URL(process.env.M7_PREVIEW_ORIGIN ?? "");
  const cli = process.env.M7_VERCEL_CLI;
  assert(cli && /^https:\/\/expanse-tracker-[a-z0-9]+-jimishgajjars-projects\.vercel\.app\/$/.test(origin.href));
  assert(target.hostname.endsWith(".neon.tech") && /^\/m7_rehearsal_[a-f0-9]{32}$/.test(target.pathname));
  const temp = await mkdtemp(join(tmpdir(),"m7-http-"));
  const db = new Client({connectionString:target.href});
  await db.connect();
  const prefix = randomUUID();
  const sessions:string[] = [];
  try {
    const {rows:[info]} = await db.query("SELECT current_database() AS db,current_setting('neon.project_id') AS project");
    assert.equal(info.project,process.env.M7_REHEARSAL_PROJECT); assert.equal(info.db,target.pathname.slice(1));
    async function session(user:string,workspace:string) {
      const token=randomBytes(32).toString("hex");
      await db.query("INSERT INTO sessions(id,user_id,workspace_id,expires_at) VALUES($1,$2,$3,now()+interval '30 minutes')",[token,user,workspace]);
      sessions.push(token);
      return token;
    }
    async function request(path:string,token:string,view?:string,change?:{method:"POST"|"PATCH";body:unknown}) {
      const dest = join(temp,randomUUID());
      const args = [cli!, "curl", path,"--deployment",origin.origin,"--","--silent","--max-time","45","--output",dest,"--write-out","%{http_code}",
        "--header","Cookie: mt_session="+token, "--header","Authorization: Bearer "+token];
      if (view) args.push("--header","x-tracker-view: "+view);
      if (change) args.push("--request",change.method,"--header","Origin: "+origin.origin,
        "--header","Content-Type: application/json","--data-binary",JSON.stringify(change.body));
      let status:number;
      try { status=Number((await execute(process.execPath,args,{windowsHide:true,timeout:75000})).stdout.trim()); }
      catch { throw Error("Protected preview request failed for " + path.split("?")[0]); }
      const bytes=await readFile(dest);
      return {status,bytes};
    }
    const owner = await session("owner","home");
    const person = "tester-"+prefix;
    await db.query("INSERT INTO users(id,email,password_hash,email_verified_at) VALUES($1,$2,'disabled',now())",[person,person+"@example.invalid"]);
    await db.query("INSERT INTO workspace_members(workspace_id,user_id,role) VALUES('home',$1,'viewer')",[person]);
    const phone = await session(person,"home");
    async function view(token:string) {
      const result=await request("/api/tracker-view",token);
      assert.equal(result.status,200);
      const key=JSON.parse(result.bytes.toString()).viewKey; assert.match(key,/^[a-f0-9]{64}$/); return key as string;
    }
    const [ownerView,phoneView] = await Promise.all([view(owner),view(phone)]);
    const householdDb=hostedHouseholdDb(target.href);
    const {rows:[source]}=await db.query("SELECT workspace_id AS ledger FROM accounts WHERE id='personal'");
    const sharer={workspace:source.ledger,actor:"member",sessionId:await session("member",source.ledger)};
    const fixture=await sharp({create:{width:1,height:1,channels:3,background:"#264f43"}}).jpeg().toBuffer();
    const entry="photo-entry-"+prefix, image="photo-"+prefix;
    await db.query("INSERT INTO transactions(id,workspace_id,account_id,type,date,amount) VALUES($1,$2,'personal','expense','2026-11-02',1)",[entry,source.ledger]);
    await db.query("INSERT INTO receipt_images(id,transaction_id,jpeg,bytes) VALUES ($1,$2,$3,$4)",[image,entry,fixture.toString("base64"),fixture.length]);
    const choice={account:"personal",recipient:person,photos:true};
    const preview=await previewAccountShare(householdDb,sharer,choice);
    await confirmAccountShare(householdDb,sharer,choice,preview.token,preview.expires);
    const [share]=await receivedShares(householdDb,{workspace:"home",actor:person,sessionId:phone});
    const photoPath="/api/account-shares?"+new URLSearchParams({share:share.id,v:share.revision,photo:image});
    const [allowed,guessed]=await Promise.all([request(photoPath,phone,phoneView),request(photoPath,owner,ownerView)]);
    assert.equal(allowed.status,200); assert.deepEqual(allowed.bytes,fixture); assert.equal(guessed.status,404);
    const endpoints = [
      "/api/mobile/bootstrap?range=month&date=2026-11-12",
      "/api/activity?start=2026-11-01&end=2026-12-01&search=PRIVATE-M7-FIXTURE",
      "/api/workspace-section?section=tools&workspace=home",
      "/api/transaction-comments/rent",
      "/api/export?workspace=home",
      "/api/mobile/notification-preferences?workspace=home",
    ];
    const results=await Promise.all(endpoints.map(p=>request(p,phone,phoneView)));
    for (const [i,result] of results.entries()) assert.equal(result.status,200,endpoints[i]);
    const json=results.map((r,i)=>i===4?null:JSON.parse(r.bytes.toString()));
    assert.deepEqual(json[0].accounts.map((a:{name:string;balance:number})=>[a.name,a.balance]),[["Joint account",88]]);
    assert.equal(json[1].total,0);assert.equal(json[2].split.reimbursementWorkspace,"home");
    assert.equal(json[3].canPost,false); assert(json[3].rows.length>=1);
    assert.equal(json[5].choices.length,6);
    const prefs=endpoints[5];
    for (const enabled of [true,false]) {
      for (const topic of ["mention","invitation"]) {
        const changed=await request(prefs,phone,phoneView,{method:"PATCH",body:{topic,channel:"push",enabled}});
        assert.equal(changed.status,200);
        const saved=JSON.parse(changed.bytes.toString()).choices.find((row:{topic:string})=>row.topic===topic);
        assert.equal(saved.push,enabled);assert.equal(saved.email,false);
      }
    }
    const post={requestId:randomUUID(),body:"Synthetic HTTPS mention",mentions:[person]};
    const sent=await request("/api/transaction-comments/rent",owner,ownerView,{method:"POST",body:post});
    assert.equal(sent.status,201);
    assert.equal((await request("/api/transaction-comments/rent",owner,ownerView,{method:"POST",body:post})).status,200);
    const workbook=new ExcelJS.Workbook(); await workbook.xlsx.load(results[4].bytes);
    const exported=JSON.stringify(workbook.worksheets.map(sheet=>sheet.getSheetValues()));
    assert(exported.includes("Joint account"));
    assert(!JSON.stringify(json).includes("PRIVATE-M7-FIXTURE") && !exported.includes("PRIVATE-M7-FIXTURE"));
    const forecast=await forecastBalances(householdDb,{workspace:"home",actor:person},
      {account:null,horizon:"30"},new Date(2026,10,12,12));
    assert.equal(forecast.opening,"88.00"); assert(!JSON.stringify(forecast).includes("PRIVATE-M7-FIXTURE"));
    await db.query("DELETE FROM workspace_members WHERE workspace_id='home' AND user_id=$1",[person]);
    const stale=await request(endpoints[0],phone,phoneView); assert.equal(stale.status,401);
    assert.equal((await request("/api/transaction-comments/rent",phone,phoneView)).status,401);
    assert.equal((await request(photoPath,phone,phoneView)).status,401);
    assert.equal((await request("/api/transaction-comments/rent",owner,ownerView)).status,200);
    console.log("PASS: protected preview bootstrap, totals, private search, household planning, comments, workbook, preferences, hosted forecast, approved/denied receipt bytes and revoked native/web access.");
  } finally {
    try { await db.query("DELETE FROM sessions WHERE id=ANY($1::text[])",[sessions]); } finally {
      await db.end(); await rm(temp,{recursive:true,force:true});
    }
  }
}
check().catch(error=>{console.error("M7 preview check failed:",error instanceof Error ? error.message : "unknown error");process.exitCode=1;});
