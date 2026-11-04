import { afterEach,expect,it,vi } from "vitest";
import { createHash,randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { AppDb } from "../../../src/lib/db";
import type { DraftBody } from "./draft-vault";

const env=vi.hoisted(()=>({disk:new Map<string,string>(),actor:"alice",workspace:"home",role:"owner",view:"v1",
  phone:vi.fn(async()=>{}),db:null as AppDb|null}));
vi.mock("expo-constants",()=>({default:{expoConfig:{extra:{apiBase:"https://local.test/api/mobile"}}}}));
vi.mock("react-native",()=>({Platform:{OS:"android"}}));
vi.mock("expo-crypto",()=>({CryptoDigestAlgorithm:{SHA256:"sha256"},randomUUID:()=>randomUUID(),
  digestStringAsync:async(_:string,v:string)=>createHash("sha256").update(v).digest("hex")}));
vi.mock("./storage",()=>({getItem:async(k:string)=>env.disk.get(k)??null,setItem:async(k:string,v:string)=>{env.disk.set(k,v);},
  deleteItem:async(k:string)=>{env.disk.delete(k);}}));
vi.mock("./phone-unlock",()=>({authenticatePhone:env.phone}));
vi.mock("./push",()=>({registerForPush:async()=>null}));
vi.mock("@/lib/session",()=>({getSession:async()=>({user:{id:env.actor,name:"Synthetic"},viewKey:env.view})}));
vi.mock("@/lib/workspace",()=>({getActiveWorkspace:async()=>({id:env.workspace,role:env.role})}));
vi.mock("@/lib/db",()=>({getDb:async()=>env.db}));
afterEach(()=>{vi.unstubAllGlobals();env.disk.clear();env.phone.mockClear();});

it("unlocks offline after restart, posts exactly once after a lost HTTP receipt, and isolates other sessions",async()=>{
  const pg=new PGlite();
  try {
    const db=drizzle(pg);
    await migrate(db,{migrationsFolder:"./drizzle"});
    env.db=db as unknown as AppDb;
    await pg.exec("INSERT INTO users(id,email,password_hash) VALUES ('alice','a@test.example','x'),('bob','b@test.example','x'); INSERT INTO workspaces(id,name,owner_id) VALUES ('home','Synthetic','alice'); INSERT INTO workspace_members(workspace_id,user_id,role) VALUES ('home','alice','owner'),('home','bob','member'); INSERT INTO accounts(id,workspace_id,name) VALUES ('bank','home','Test');");
    const {POST}=await import("../../../src/app/api/mobile/device-drafts/route");
    let offline=false,expired=false,loseReceipt=true,hits=0;
    vi.stubGlobal("fetch",async(url:string,opts:RequestInit)=>{
      if(offline) throw Error("airplane mode");
      if(url.endsWith("/auth/login")) return Response.json({token:env.actor+"-session"});
      if(url.endsWith("/auth/logout")) return Response.json({});
      if(expired) return Response.json({}, {status:401});
      if(url.includes("/me")) return Response.json({user:{id:env.actor},workspaces:[{id:env.workspace,role:env.role}],
        activeWorkspaceId:env.workspace,viewKey:env.view,expiresAt:new Date(Date.now()+86400000).toISOString()});
      if(!url.endsWith("/device-drafts")) throw Error("Unexpected endpoint");
      hits++;
      const res=await POST(new Request(url,opts));
      if(loseReceipt && res.ok){loseReceipt=false;throw Error("response lost after commit");}
      return res;
    });
    async function boot(){
      vi.resetModules();
      const {useAuth}=await import("./auth");
      const {openDeviceDrafts,currentDraftScope}=await import("./device-drafts");
      await useAuth.getState().hydrate();
      return {auth:()=>useAuth.getState(),open:()=>openDeviceDrafts(currentDraftScope()!),scope:currentDraftScope};
    }
    let phone=await boot();
    await phone.auth().signIn("a@test.example","demo");await phone.auth().configureLock(true);
    offline=true;phone=await boot();
    expect(phone.auth().deviceLocked).toBe(true);expect(phone.scope()).toBeNull();
    env.phone.mockRejectedValueOnce(Error("cancelled"));
    await expect(phone.auth().unlockPhone()).rejects.toThrow("cancelled");
    expect(phone.scope()).toBeNull();
    await phone.auth().unlockPhone();
    const body:DraftBody={type:"expense",amount:"7.37",date:"2026-11-01",note:"Synthetic",accountId:"",categoryId:null,tagIds:[]};
    const draft=await phone.open().save(randomUUID(),0,body);
    await expect(phone.open().post(draft)).rejects.toThrow("Reconnect");expect(hits).toBe(0);
    phone=await boot();await phone.auth().unlockPhone();
    expect(await phone.open().list()).toEqual([draft]);
    offline=false;await phone.auth().verify();
    const reviewed=await phone.open().save(draft.id,draft.revision,{...body,accountId:"bank"});
    await expect(phone.open().post(reviewed)).rejects.toThrow("interrupted");
    phone=await boot();await phone.auth().unlockPhone();
    const [pending]=await phone.open().list();
    expect(pending.pending).toBe(true);
    expect(await phone.open().post(pending)).toMatchObject({requestId:draft.id,replayed:true});
    expect((await pg.query("SELECT amount FROM transactions")).rows).toEqual([{amount:"7.37"}]);
    expect(await phone.open().list()).toEqual([]);
    // Simulate a conflicting restored device copy of a previously posted request.
    const collision=await phone.open().save(draft.id,0,{...body,accountId:"bank",amount:"20.00"});
    await expect(phone.open().post(collision)).rejects.toThrow("different details");
    const [conflict]=await phone.open().list();
    expect(conflict).toMatchObject({conflict:"different",body:{amount:"20.00"}});
    await expect(phone.open().post(conflict)).rejects.toThrow("receipt");
    await phone.open().discard(conflict);
    expect((await pg.query("SELECT amount FROM transactions")).rows).toEqual([{amount:"7.37"}]);
    const old=phone.open();await old.save(randomUUID(),0,body);
    phone.auth().suspend();expect(phone.scope()).toBeNull();
    await phone.auth().verify();expect(phone.auth().deviceLocked).toBe(true);
    offline=true;
    const clock=vi.spyOn(Date,"now").mockReturnValue(Date.now()+2*86400000);
    try {await phone.auth().unlockPhone();expect(phone.scope()).toBeNull();} finally {clock.mockRestore();}
    offline=false;await phone.auth().verify();
    env.workspace="elsewhere";env.view="v2";await phone.auth().verify();
    expect(await phone.open().list()).toEqual([]);
    await expect(old.list()).rejects.toThrow("original tracker");
    env.workspace="home";env.view="v3";await phone.auth().verify();
    expect(await phone.open().list()).toHaveLength(1);
    expired=true;await phone.auth().verify();expect(phone.auth().token).toBeNull();expect(phone.scope()).toBeNull();
    expired=false;env.actor="bob";env.view="v4";await phone.auth().signIn("b@test.example","demo");
    expect(await phone.open().list()).toEqual([]);await expect(old.list()).rejects.toThrow("original tracker");
    const mismatch=await POST(new Request("https://local.test",{method:"POST",headers:{"x-tracker-view":"v4"},
      body:JSON.stringify({actor:"alice",workspace:"home",requestId:draft.id,entry:{...body,accountId:"bank"}})}));
    expect(mismatch.status).toBe(403);expect(hits).toBe(3);
    await phone.auth().signOut();expect(phone.scope()).toBeNull();
  } finally {await pg.close();}
},60000);
