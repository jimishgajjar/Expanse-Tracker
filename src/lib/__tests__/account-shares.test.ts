import { AsyncLocalStorage } from "node:async_hooks";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import sharp from "sharp";
import * as schema from "../db/schema";
import { createApiSession } from "../session";
import { openPersonalLedger } from "../personal-ledger";
import { attachReceipt } from "../receipt-images";
import { VIEW_HEADER } from "../tracker-view";
import { GET as checkView } from "@/app/api/tracker-view/route";
import { GET, POST } from "@/app/api/account-shares/route";
import type { AppDb } from "../db";

const pg = new PGlite();
const db = drizzle(pg,{schema});
const context = new AsyncLocalStorage<Headers>();
vi.mock("../db",()=>({getDb:async()=>db}));
vi.mock("../personal-preview",()=>({personalPreviewEnabled:()=>true}));
vi.mock("next/headers",()=>({cookies:async()=>({get:()=>undefined}),headers:async()=>context.getStore()!}));

async function client(actor:string, workspace:string) {
  const token = await createApiSession(actor,workspace);
  const headers = new Headers({authorization:"Bearer "+token,host:"localhost",origin:"http://localhost","content-type":"application/json"});
  const {viewKey} = await context.run(headers,async()=> (await checkView()).json());
  headers.set(VIEW_HEADER,viewKey);
  return {
    get:(query:Record<string,string>={})=>context.run(headers,()=>GET(new Request("http://localhost/api/account-shares?"+new URLSearchParams(query),{headers}))),
    post:(body:object)=>context.run(headers,()=>POST(new Request("http://localhost/api/account-shares",{method:"POST",headers,body:JSON.stringify(body)}))),
  };
}
let mine:string,photo:string,bytes:Buffer;
let owner:Awaited<ReturnType<typeof client>>, reader:typeof owner, admin:typeof owner, stranger:typeof owner;
const choice = {account:"checking",recipient:"reader",photos:true};
beforeAll(async()=>{
  await migrate(db,{migrationsFolder:"./drizzle"});
  await pg.exec(`INSERT INTO users(id,email,name,password_hash) SELECT id,id||'@example.test',id,'unused'
    FROM unnest(ARRAY['admin','owner','reader','outsider']) id;
    INSERT INTO workspaces(id,name,owner_id) VALUES('home','Our household','admin'),('away','Elsewhere','outsider');
    INSERT INTO workspace_members(workspace_id,user_id,role) VALUES ('home','admin','owner'),('home','owner','member'),
      ('home','reader','viewer'),('away','outsider','owner');
    INSERT INTO app_settings(workspace_id,currency_code) VALUES('home','CAD');`);
  mine=await openPersonalLedger(pg,{workspace:"home",actor:"owner"});
  await pg.query("INSERT INTO accounts(id,workspace_id,name,initial_balance) VALUES('checking',$1,'Checking',100),('secret',$1,'Other private bank',0)",[mine]);
  await pg.query(`INSERT INTO transactions(id,workspace_id,account_id,type,amount,note,date) VALUES
    ('spend',$1,'checking','expense',3.21,'Coffee','2026-10-10'),('pay',$1,'checking','income',10,'Wages','2026-10-11'),
    ('other',$1,'secret','income',999,'UNRELATED NOTE','2026-10-12')`,[mine]);
  await pg.query("INSERT INTO transfers(id,workspace_id,from_account_id,to_account_id,amount,date,note) VALUES('move',$1,'checking','secret',2,'2026-10-11','PRIVATE MEMO')",[mine]);
  bytes=await sharp({create:{width:2,height:2,channels:3,background:"white"}}).jpeg().toBuffer();
  await attachReceipt(db as unknown as AppDb,{workspace:mine,actor:"owner"},"spend",bytes);
  photo=(await pg.query<{id:string}>("SELECT id FROM receipt_images WHERE transaction_id='spend'")).rows[0].id;
  [owner,reader,admin,stranger]=await Promise.all([client("owner",mine),client("reader","home"),client("admin","home"),client("outsider","away")]);
},60000);
afterAll(()=>pg.close());

it("requires an owner-reviewed, session-bound copy for one named member and verifies receipt bytes",async()=>{
  expect((await admin.get({account:"checking"})).status).toBe(404);
  expect((await admin.post({action:"preview",...choice})).status).toBe(404);
  expect((await stranger.get({account:"checking",photo,v:"any"})).status).toBe(404);
  expect((await owner.post({action:"preview",...choice,recipient:"outsider"})).status).toBe(404);
  const preview = async (photos=true) => {
    const res=await owner.post({action:"preview",...choice,photos}); expect(res.status).toBe(200); return res.json();
  };
  const claim = (p:{token:string;expires:number}, photos=true) => ({action:"confirm",...choice,photos,token:p.token,expires:p.expires});
  const first=await preview();
  expect(first.audience).toEqual({name:"reader",email:"reader@example.test",household:"Our household"});
  expect(first.report).toMatchObject({opening:"100.00",balance:"104.79",currency:"CAD"});
  expect(first.report.lines).toHaveLength(3);
  expect(JSON.stringify(first.report)).not.toMatch(/PRIVATE MEMO|Other private bank|UNRELATED NOTE/);
  expect(await (await reader.get()).json()).toEqual({list:[],detail:null});
  expect((await owner.post({...claim(first),recipient:"admin"})).status).toBe(409);
  expect((await (await client("owner",mine)).post(claim(first))).status).toBe(409);
  expect((await owner.post({...claim(first),expires:Date.now()-1})).status).toBe(409);
  await pg.exec("UPDATE transactions SET note='Coffee with Alex' WHERE id='spend'");
  expect((await owner.post(claim(first))).status).toBe(409);
  const without=await preview(false);
  expect(JSON.stringify(without.report)).not.toContain(photo);
  expect((await owner.post(claim(without,false))).status).toBe(200);
  const [entry]=(await (await reader.get()).json()).list;
  expect((await reader.get({share:entry.id,photo,v:entry.revision})).status).toBe(404);
  const withPhotos=await preview();
  expect((await owner.post(claim(withPhotos))).status).toBe(200);
  expect((await owner.post(claim(withPhotos))).status).toBe(200);
  const copy=await (await reader.get({share:entry.id})).json();
  expect(copy.list).toHaveLength(1); expect(copy.detail.report).toEqual(withPhotos.report);
  const params={share:entry.id,photo,v:copy.detail.revision};
  const response=await reader.get(params);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
  for (const other of [admin,stranger]) {
    expect((await (await other.get({share:entry.id})).json()).detail).toBeNull();
    expect((await other.get(params)).status).toBe(404);
  }
  await pg.exec("UPDATE transactions SET amount=50 WHERE id='pay'");
  expect((await (await reader.get({share:entry.id})).json()).detail.report.balance).toBe("104.79");
  await pg.query("UPDATE receipt_images SET jpeg=$1 WHERE id=$2",[Buffer.from("new pixels").toString("base64"),photo]);
  expect((await reader.get(params)).status).toBe(404);
  expect((await owner.post({action:"stop",...choice,revision:entry.revision})).status).toBe(409);
  expect((await owner.post({action:"stop",...choice,revision:copy.detail.revision})).status).toBe(200);
  expect((await (await reader.get({share:entry.id})).json()).list).toEqual([]);
  expect((await owner.post(claim(withPhotos))).status).toBe(409);
  const latest=await preview(false);
  expect((await owner.post(claim(latest,false))).status).toBe(200);
  await pg.exec("DELETE FROM workspace_members WHERE workspace_id='home' AND user_id='reader'");
  await pg.exec("INSERT INTO workspace_members(workspace_id,user_id,role) VALUES('home','reader','viewer')");
  expect((await (await reader.get()).json()).list).toEqual([]);
  expect((await owner.post(claim(latest,false))).status).toBe(409);
  expect((await pg.query("SELECT workspace_id FROM transactions WHERE id='spend'")).rows).toEqual([{workspace_id:mine}]);
});
