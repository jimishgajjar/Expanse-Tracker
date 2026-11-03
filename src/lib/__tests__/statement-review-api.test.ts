import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { AppDb } from "../db";
import { startStatementReview } from "../statement-review-store";

const state=vi.hoisted(()=>({db:null as unknown as AppDb,signedIn:true}));
vi.mock("../db",()=>({getDb:async()=>state.db}));
vi.mock("../workspace",()=>({getActiveWorkspaceId:async()=>state.signedIn?"home":null}));
vi.mock("../session",()=>({getCurrentUser:async()=>state.signedIn?{id:"u",name:"Owner",email:"owner@example.test"}:null}));
vi.mock("../queries",()=>({getAccountsWithBalances:async()=>[],getCategories:async()=>[],getAllTransactions:async()=>[]}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import { startReview, loadReview, saveReview, correctStatement } from "../statement-review-actions";
import { GET } from "../../app/api/export/route";

let client:PGlite;
const input=()=>({id:randomUUID(),accountId:"a",start:"2026-10-01",end:"2026-10-31",closingBalance:"0"});
beforeAll(async()=>{client=new PGlite();const local=drizzle(client);await migrate(local,{migrationsFolder:"./drizzle"});state.db=local as unknown as AppDb;},60000);
beforeEach(async()=>{
  vi.stubEnv("STATEMENT_REVIEWS_ENABLED","1");state.signedIn=true;
  await client.exec(`TRUNCATE users,workspaces CASCADE;
    INSERT INTO users(id,email,password_hash) VALUES ('u','owner@example.test','x'),('other','other@example.test','x');
    INSERT INTO workspaces(id,name,owner_id) VALUES ('home','Home','u'),('foreign','Private','other');
    INSERT INTO workspace_members(workspace_id,user_id,role) VALUES ('home','u','owner'),('foreign','other','owner');
    INSERT INTO accounts(id,workspace_id,name) VALUES ('a','home','Bank'),('private','foreign','Private');`);
});
afterAll(async()=>{await client?.close();vi.unstubAllEnvs();});

it("gates corrections separately and exports the reason and transaction reference for the signed-in actor",async()=>{
  const started=await startReview({...input(),closingBalance:"-3.00"});if(!started.ok)throw Error(started.error);
  const data={id:started.review.id,version:1,requestId:randomUUID(),date:"2026-10-04",amount:"3.00",type:"expense",
    description:"Statement fee",reason:"Verified on October statement",verified:true,separatePurchase:false};
  vi.stubEnv("STATEMENT_CORRECTIONS_ENABLED","0");
  expect(await correctStatement(data)).toMatchObject({ok:false,error:"Recording statement corrections is not enabled."});
  vi.stubEnv("STATEMENT_CORRECTIONS_ENABLED","1");state.signedIn=false;
  expect((await correctStatement(data)).ok).toBe(false);state.signedIn=true;
  const result=await correctStatement(data);if(!result.ok)throw Error(result.error);
  const tx=result.review.entryChanges[0].after!.id.slice(3);
  const response=await GET(), wb=new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await response.arrayBuffer()) as unknown as Parameters<typeof wb.xlsx.load>[0]);
  const row=wb.getWorksheet("Review events")!.getRow(3);
  expect([2,5,10,11].map(i=>row.getCell(i).value)).toEqual(["correction","u",tx,data.reason]);
});

it("keeps saved-review actions disabled by default and requires sign-in",async()=>{
  vi.stubEnv("STATEMENT_REVIEWS_ENABLED","");expect(await startReview(input())).toMatchObject({ok:false,error:"Saved statement reviews are not enabled yet."});
  vi.stubEnv("STATEMENT_REVIEWS_ENABLED","1");state.signedIn=false;
  expect(await startReview(input())).toMatchObject({ok:false,error:"Sign in to access statement reviews."});
  expect((await client.query("SELECT count(*)::int AS n FROM reconciliation_sessions")).rows[0]).toEqual({n:0});
});
it("uses server identity and completes an exact empty statement without ledger changes",async()=>{
  const result=await startReview({...input(),workspaceId:"foreign",actorId:"other"});
  expect(result.ok).toBe(true);if(!result.ok)throw new Error(result.error);
  expect(result.review.actorName).toBe("Owner");
  const completed=await saveReview({id:result.review.id,version:1,decisions:{},duplicatesReviewed:false,complete:true});
  expect(completed.ok && completed.review.effectiveStatus).toBe("completed");
  expect((await client.query("SELECT count(*)::int AS n FROM transactions")).rows[0]).toEqual({n:0});
});
it("rechecks a changed role and prevents foreign-session reads",async()=>{
  const result=await startReview(input());if(!result.ok)throw new Error(result.error);
  await client.exec("UPDATE workspace_members SET role='viewer' WHERE workspace_id='home'");
  expect((await loadReview(result.review.id)).ok).toBe(true);
  expect((await saveReview({id:result.review.id,version:1,decisions:{},duplicatesReviewed:false,complete:true})).ok).toBe(false);
  const foreign=await startStatementReview(state.db,"foreign",{id:"other",name:"Private"},{...input(),accountId:"private"});
  expect((await loadReview(foreign)).ok).toBe(false);
});
it("exports scoped evidence and decision history in separate sheets",async()=>{
  await client.exec("INSERT INTO transactions(id,workspace_id,type,amount,date,account_id,note) VALUES ('expense','home','expense',1,'2026-10-01','a','Sample coffee')");
  const result=await startReview({...input(),closingBalance:"-1"});if(!result.ok)throw new Error(result.error);
  const saved=await saveReview({id:result.review.id,version:1,decisions:{"tx:expense":"cleared"},duplicatesReviewed:false,complete:true});expect(saved.ok).toBe(true);
  await startStatementReview(state.db,"foreign",{id:"other",name:"Private"},{...input(),accountId:"private"});
  const response=await GET();expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toBe("no-store");
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const reviews=workbook.getWorksheet("Statement reviews")!;
  expect(reviews.rowCount).toBe(2);expect(reviews.getRow(2).getCell(1).value).toBe(result.review.id);
  expect(reviews.getRow(2).getCell(8).value).toBe("completed");
  const entries=workbook.getWorksheet("Reviewed entries")!;
  expect(entries.getRow(2).getCell(7).value).toBe("Sample coffee");expect(entries.getRow(2).getCell(11).value).toBe("cleared");
  const events=workbook.getWorksheet("Review events")!;expect(events.rowCount).toBe(3);expect(events.getRow(3).getCell(2).value).toBe("completed");
});
