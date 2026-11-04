import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import ExcelJS from "exceljs";
import * as schema from "../db/schema";
import type { AppDb } from "../db";
import { openPersonalLedger } from "../personal-ledger";
import { forecastBalances } from "../balance-forecast";

const auth = vi.hoisted(() => ({actor:"admin",ws:"home",db:null as unknown as AppDb,mail:vi.fn(),push:vi.fn()}));
vi.mock("../db",()=>({getDb:async()=>auth.db}));
vi.mock("../session",()=>({
  getSession:async()=>({user:{id:auth.actor,email:auth.actor+"@example.test"},workspaceId:auth.ws,sessionId:"synthetic"}),
  getCurrentUser:async()=>({id:auth.actor,email:auth.actor+"@example.test"}),
}));
vi.mock("../email",()=>({emailConfigured:()=>true,sendEmail:auth.mail}));
vi.mock("../push",()=>({pushConfigured:()=>true,sendPushToSub:auth.push}));
vi.mock("next/cache",()=>({revalidatePath:()=>{}}));
vi.mock("../merchant-rule-feature",()=>({merchantRulesEnabled:()=>true}));
vi.mock("../statement-review-feature",()=>({statementReviewsEnabled:()=>true,statementCorrectionsEnabled:()=>true}));
vi.mock("../file-import-model",async(importReal)=>({...await importReal<typeof import("../file-import-model")>(),fileImportsEnabled:()=>true}));

import { GET as activity } from "@/app/api/activity/route";
import { GET as bootstrap } from "@/app/api/mobile/bootstrap/route";
import { GET as exportWorkbook } from "@/app/api/export/route";
import { GET as history } from "@/app/api/transaction-history/[id]/route";
import { GET as backupStatus } from "@/app/api/backup-status/route";
import { getOverviewData } from "../overview-data";
import { getUserWorkspaces, getActiveWorkspaceId } from "../workspace";
import { attachReceipt, receiptBytes, receiptInfo } from "../receipt-images";
import { createTransfer, updateTransaction, deleteTransaction } from "../actions";
import { notifyWorkspace } from "../notify";
import { sendMonthlyDigests } from "../cron-tasks";
import { GET as planningTools } from "@/app/api/workspace-section/route";
import { getRecurring } from "../queries";
import * as personalPreview from "../personal-preview";
import { weeklyHouseholdCheckIn } from "../weekly-household";

const pg=new PGlite(), scope=(actor:string,workspace="home")=>({actor,workspace});
let mine:string, other:string, photo:string;
const req=(url:string)=>new Request("http://localhost"+url);
const query=(search="")=>activity(req("/api/activity?start=2026-11-01&end=2026-12-01&search="+encodeURIComponent(search)));
const readHistory=(id:string)=>history(req("/history"),{params:Promise.resolve({id})});
const forecast=(workspace:string,actor:string)=>forecastBalances(pg,scope(actor,workspace),{account:null,horizon:"30"},new Date(2026,10,12,12));
async function workbook() {
  const res=await exportWorkbook(req("/api/export?workspace="+encodeURIComponent(auth.ws)));
  expect(res.status).toBe(200);
  const book=new ExcelJS.Workbook();
  await book.xlsx.load(await res.arrayBuffer());
  return JSON.stringify(book.worksheets.map(s=>s.getSheetValues()));
}
beforeAll(async()=>{
  const db=drizzle(pg,{schema});
  await migrate(db,{migrationsFolder:"./drizzle"});
  auth.db=db as unknown as AppDb;
  await pg.exec(`INSERT INTO users(id,email,password_hash) SELECT id,id||'@example.test','x' FROM unnest(ARRAY['admin','one','two','view','out']) id;
    INSERT INTO workspaces(id,name,owner_id) VALUES ('home','Home','admin'),('away','Other household','out');
    INSERT INTO workspace_members(workspace_id,user_id,role) VALUES ('home','admin','owner'),('home','one','member'),('home','two','member'),('home','view','viewer'),('away','out','owner');
    INSERT INTO app_settings(workspace_id,currency_code) VALUES ('home','CAD');
    INSERT INTO accounts(id,workspace_id,name) VALUES ('joint','home','Joint');
    INSERT INTO transactions(id,workspace_id,type,date,amount,account_id,created_by) VALUES ('rent','home','expense','2026-11-01',12,'joint','one');`);
  mine=await openPersonalLedger(pg,scope("one")); other=await openPersonalLedger(pg,scope("two"));
  for(const [ledger,account,amount,person] of [[mine,"secret-one",741,"one"],[other,"secret-two",923,"two"]] as const){
    await pg.query("INSERT INTO accounts(id,workspace_id,name) VALUES ($1,$2,$1)",[account,ledger]);
    await pg.query("INSERT INTO transactions(id,workspace_id,type,date,amount,account_id,note,created_by) VALUES ($1,$2,'income','2026-11-01',$3,$4,$4,$5)",[account+"-tx",ledger,amount,account,person]);
  }
  await attachReceipt(auth.db,scope("one",mine),"secret-one-tx",Buffer.from("private fixture"));
  photo=(await receiptInfo(auth.db,scope("one",mine),"secret-one-tx"))!.id;
  await pg.query(`INSERT INTO reconciliation_sessions(id,workspace_id,account_id,start_date,end_date,closing_balance,snapshot,actor_name)
    VALUES ('personal-review',$1,'secret-one','2026-11-01','2026-11-10',741,$2,'Owner')`,[mine,JSON.stringify({
    initialBalance:"0",currency:"CAD",entries:[{id:"older-id",date:"2026-11-01",kind:"income",amount:"741",note:"snapshot-only-marker"}],
  })]);
  await pg.query(`INSERT INTO file_imports(id,workspace_id,file_hash,filename,headers,mapping,currency,rows,staged_by)
    VALUES ('personal-import',$1,'test-hash','import-only-marker.csv','[]','{}','CAD','[]','one')`,[mine]);
},60000);
beforeEach(()=>{auth.actor="admin";auth.ws="home";vi.clearAllMocks();});
afterAll(async()=>{await pg.close();});

it("creates only fresh personal scopes; a person's existing shared entries never move",async()=>{
  expect(await openPersonalLedger(pg,scope("one"))).toBe(mine);
  await expect(openPersonalLedger(pg,scope("view"))).rejects.toThrow("Editing access");
  await expect(openPersonalLedger(pg,scope("out"))).rejects.toThrow("membership");
  await expect(openPersonalLedger(pg,scope("one",mine))).rejects.toThrow("household");
  expect((await pg.query("SELECT workspace_id,created_by FROM transactions WHERE id='rent'")).rows).toEqual([{workspace_id:"home",created_by:"one"}]);
  expect((await pg.query("SELECT currency_code FROM app_settings WHERE workspace_id=$1",[mine])).rows).toEqual([{currency_code:"CAD"}]);
});

it.each(["admin","one","two","view"])("excludes both private accounts before search, totals, reports, export and mobile serialization for %s in Home",async actor=>{
  auth.actor=actor;
  const result=await (await query()).json();
  expect(result).toMatchObject({total:1,income:0,expense:12,transactions:[{id:"rent"}]});
  expect((await (await query("secret")).json()).total).toBe(0);
  const overview=await getOverviewData("2026-11-01","2026-12-01","month");
  expect(overview.chartTransactions.map(r=>r.amount)).toEqual([12]);
  const projection=await forecast("home",actor);
  expect(projection.opening).toBe("-12.00");
  expect(projection.openingAccounts.map(a=>a.id)).toEqual(["joint"]);
  const mobile=await (await bootstrap(req("/mobile/bootstrap?range=month&date=2026-11-12"))).json();
  expect(mobile.accounts).toMatchObject([{id:"joint",balance:-12}]);
  expect(mobile.transactions).toMatchObject([{id:"rent"}]);
  expect(await workbook()).not.toMatch(/secret-one|secret-two|private fixture|snapshot-only-marker|import-only-marker/);
  expect((await readHistory("secret-one-tx")).status).toBe(404);
  expect(await receiptBytes(auth.db,scope(actor),"secret-one-tx",photo)).toBeNull();
});

it("serves the owner's own records and rejects guessed ledger IDs, mixed transfers and foreign receipts",async()=>{
  auth.actor="one";auth.ws=mine;
  expect((await exportWorkbook(req("/api/export?workspace=home"))).status).toBe(409);
  expect((await exportWorkbook(req("/api/export"))).status).toBe(409);
  expect((await getUserWorkspaces()).map(w=>w.id).sort()).toEqual(["home",mine].sort());
  expect((await (await query()).json())).toMatchObject({total:1,income:741,expense:0});
  expect((await forecast(mine,"one")).opening).toBe("741.00");
  expect((await (await readHistory("secret-one-tx")).json()).access).toMatchObject({personal:true,canEdit:true});
  const exported=await workbook();
  expect(exported).toContain("secret-one-tx");expect(exported).toContain(photo);
  expect(exported).toContain("snapshot-only-marker");expect(exported).toContain("import-only-marker");
  expect(exported).not.toMatch(/secret-two|Joint/);
  expect((await receiptBytes(auth.db,scope("one",mine),"secret-one-tx",photo))?.toString()).toBe("private fixture");
  expect(await createTransfer({fromAccountId:"secret-one",toAccountId:"joint",amount:1,date:"2026-11-11"})).toMatchObject({ok:false});
  for (const actor of ["admin","two","view","out"]) {
    auth.actor=actor;
    expect(await getActiveWorkspaceId()).toBeNull();
    expect((await query()).status).toBe(401);
    expect((await exportWorkbook(req("/api/export"))).status).toBe(401);
    expect((await readHistory("secret-one-tx")).status).toBe(404);
    expect(await receiptBytes(auth.db,scope(actor,mine),"secret-one-tx",photo)).toBeNull();
    await expect(forecast(mine,actor)).rejects.toThrow("Access");
  }
});

it("blocks sharing the private ledger through legacy membership, invite or ownership paths",async()=>{
  await expect(pg.query("INSERT INTO workspace_members(workspace_id,user_id,role) VALUES ($1,'admin','viewer')",[mine])).rejects.toThrow("Personal access");
  await expect(pg.query("INSERT INTO invitations(workspace_id,email) VALUES ($1,'test@example.test')",[mine])).rejects.toThrow("invitation");
  await expect(pg.query("UPDATE workspaces SET owner_id='admin' WHERE id=$1",[mine])).rejects.toThrow("ownership");
  await expect(pg.query("DELETE FROM personal_ledgers WHERE ledger_id=$1",[mine])).rejects.toThrow("detach");
});

it("never follows a mismatched historical category, account or tag into another tracker",async()=>{
  await pg.query("INSERT INTO categories(id,workspace_id,name,kind) VALUES ('private-cat',$1,'PRIVATE LABEL','expense')",[mine]);
  await pg.query("INSERT INTO tags(id,workspace_id,name) VALUES ('private-tag',$1,'PRIVATE TAG'),('home-tag','home','Shared tag')",[mine]);
  await pg.exec(`INSERT INTO transactions(id,workspace_id,type,date,amount,account_id,category_id)
    VALUES ('legacy','home','expense','2026-11-02',1,'secret-one','private-cat');
    INSERT INTO transaction_tags(transaction_id,tag_id) VALUES ('legacy','private-tag'),('secret-one-tx','home-tag');`);
  try {
    const mobile=await (await bootstrap(req("/mobile/bootstrap?range=month&date=2026-11-12"))).json();
    expect(mobile.transactions.find((t:{id:string})=>t.id==="legacy")).toMatchObject({accountId:null,categoryId:null,account:null,category:null,tags:[]});
    expect(mobile.tags.find((t:{id:string})=>t.id==="home-tag").count).toBe(0);
    const list=await (await query()).json();
    expect(list.transactions.find((t:{id:string})=>t.id==="legacy")).toMatchObject({accountId:null,categoryId:null,tags:[]});
    expect((await (await query("PRIVATE LABEL")).json()).total).toBe(0);
    expect(await workbook()).not.toMatch(/PRIVATE LABEL|PRIVATE TAG|secret-one/);
  } finally {
    await pg.exec("DELETE FROM transactions WHERE id='legacy'; DELETE FROM tags WHERE id IN ('private-tag','home-tag'); DELETE FROM categories WHERE id='private-cat'");
  }
});

it("inherits a downgrade and revocation without deleting any entries or attachments",async()=>{
  auth.actor="one";auth.ws=mine;
  try {
    await pg.exec("UPDATE workspace_members SET role='viewer' WHERE workspace_id='home' AND user_id='one'");
    expect((await (await readHistory("secret-one-tx")).json()).access.canEdit).toBe(false);
    expect(await updateTransaction("secret-one-tx",{amount:12})).toMatchObject({ok:false});
    expect(await deleteTransaction("secret-one-tx")).toMatchObject({ok:false});
    await pg.exec("DELETE FROM workspace_members WHERE workspace_id='home' AND user_id='one'");
    expect(await getActiveWorkspaceId()).toBeNull();
    expect((await readHistory("secret-one-tx")).status).toBe(404);
    expect(await receiptBytes(auth.db,scope("one",mine),"secret-one-tx",photo)).toBeNull();
    expect((await (await bootstrap(req("/bootstrap"))).json()).accounts).toEqual([]);
    expect((await pg.query("SELECT amount FROM transactions WHERE id='secret-one-tx'")).rows).toEqual([{amount:"741.00"}]);
  } finally {
    await pg.exec("INSERT INTO workspace_members(workspace_id,user_id,role) VALUES('home','one','member') ON CONFLICT(workspace_id,user_id) DO UPDATE SET role='member'");
  }
  expect((await receiptBytes(auth.db,scope("one",mine),"secret-one-tx",photo))?.toString()).toBe("private fixture");
});

it("does not deliver private reminders/digests or disclose database-wide backup counts",async()=>{
  await notifyWorkspace(mine,{topic:"upcoming",title:"secret-one",body:"private fixture"});
  expect(auth.mail).not.toHaveBeenCalled();expect(auth.push).not.toHaveBeenCalled();
  await pg.query("UPDATE app_settings SET digest_enabled=true WHERE workspace_id=$1",[mine]);
  await pg.exec("UPDATE users SET email_verified_at=now() WHERE id='admin'; INSERT INTO notification_preferences VALUES ('home','admin','monthly','email')");
  await sendMonthlyDigests(new Date(2026,11,1,12));
  expect(auth.mail).toHaveBeenCalled();
  expect(JSON.stringify(auth.mail.mock.calls)).not.toMatch(/secret-one|secret-two|741\.00|923\.00/);
  await pg.exec("INSERT INTO backup_reports(workspace_id,verified_at,row_count) VALUES('home',now(),99791)");
  expect(await (await backupStatus()).text()).not.toMatch(/rowCount|99791/);
});

it("builds the same household check-in for two members and a viewer without disclosing private or settled records", async () => {
  const preview = vi.spyOn(personalPreview, "personalPreviewEnabled").mockReturnValue(true);
  const readTools = (workspace: string) => planningTools(req("/api/workspace-section?section=tools&workspace=" + workspace));
  try {
    for (const [workspace, prefix] of [["home","joint"], [mine,"private"]] as const) {
      await pg.query("INSERT INTO goals(id,workspace_id,name,target_amount,saved_amount) VALUES ($1,$2,$1,100,80)", [prefix+"-goal",workspace]);
      await pg.query("INSERT INTO recurring(id,workspace_id,note,type,amount,frequency,next_date) VALUES ($1,$2,$1,'expense',12,'weekly','2026-11-12')", [prefix+"-bill",workspace]);
    }
    await pg.exec(`INSERT INTO splits(id,workspace_id,creditor_id,debtor_id,amount,settled_at) VALUES
      ('open','home','one','two',2.55,null),('paid','home','one','two',40,now())`);
    for (const person of ["one","two","view"]) {
      auth.actor = person;
      const response = await readTools("home");
      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      const {goals, split} = await response.json();
      const review = weeklyHouseholdCheckIn("home","2026-11-11",split,await getRecurring(),goals)!;
      expect(review.reimbursements.map(r=>r.amount)).toEqual([2.55]);
      expect(review.bills.map(b=>b.id)).toEqual(["joint-bill"]);
      expect(review.goals.map(g=>[g.id,g.savedAmount,g.openingProgress])).toEqual([["joint-goal",0,80]]);
      expect(JSON.stringify(review)).not.toContain("private-");
    }
    auth.actor = "one"; auth.ws = mine;
    expect((await readTools("home")).status).toBe(409);
    const personal = await (await readTools(mine)).json();
    expect(weeklyHouseholdCheckIn(mine,"2026-11-11",personal.split,await getRecurring(),personal.goals)).toBeNull();
    auth.actor = "out"; auth.ws = "home";
    expect((await readTools("home")).status).toBe(401);
    expect(await getRecurring()).toEqual([]);
    expect((await pg.query("SELECT amount FROM splits WHERE id='open' AND settled_at IS NULL")).rows).toEqual([{amount:"2.55"}]);
    expect((await pg.query("SELECT next_date::text AS next,occurrence_count FROM recurring WHERE id='joint-bill'")).rows)
      .toEqual([{next:"2026-11-12",occurrence_count:0}]);
  } finally { preview.mockRestore(); }
});
