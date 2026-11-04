import {afterAll,beforeAll,beforeEach,expect,it,vi} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {randomBytes} from "node:crypto";
import {resolve} from "node:path";
import {Inbox} from "../plaid-sandbox/inbox";
import {SandboxError,type SandboxProvider} from "../plaid-sandbox/provider";
import {openToken,sealToken} from "../plaid-sandbox/vault";
import {sandboxInboxEnabled} from "../plaid-sandbox/config";
const key=randomBytes(32),secret="access-sandbox-fictional";
const txn={transaction_id:"txn",account_id:"A",name:"Coffee",amount:4.25,iso_currency_code:"CAD",date:"2026-11-03",pending:false,pending_transaction_id:null};
const page={added:[txn],removed:[],modified:[],has_more:false,next_cursor:"cursor",transactions_update_status:"HISTORICAL_UPDATE_COMPLETE" as const};
const provider={createLink:vi.fn(async()=>({link_token:"link-sandbox-test"})),exchange:vi.fn(async()=>({item_id:"item",access_token:secret})),
  accounts:vi.fn(async()=>({item:{item_id:"item"},accounts:[{account_id:"A",type:"depository",subtype:"checking"},{account_id:"B",type:"credit",subtype:null}]})),
  sync:vi.fn(async(_token:string,_account:string,cursor:string|null)=>cursor?{...page,added:[]}:page),remove:vi.fn(async()=>({request_id:"test"}))};
let db:PGlite,svc:Inbox;
beforeAll(async()=>{db=new PGlite();svc=new Inbox(db,provider as unknown as SandboxProvider,key);await svc.view("home");},60000);
beforeEach(async()=>{await db.exec("DELETE FROM connections");vi.clearAllMocks();});
afterAll(async()=>{await db?.close();});
async function linked(){
  const {id}=await svc.begin("home");await svc.exchange("home",id,"public-sandbox-test");return id;
}
it("cancels setup without exchanging or syncing, including stale callbacks",async()=>{
  const {id}=await svc.begin("home");await svc.cancel("home",id);
  await expect(svc.exchange("home",id,"public-sandbox-x")).rejects.toThrow("STALE_CONNECTION");
  expect(await svc.view("home")).toBeNull();expect(provider.exchange).not.toHaveBeenCalled();expect(provider.sync).not.toHaveBeenCalled();
});
it("never accepts a second workspace, unoffered account, or duplicate exchange",async()=>{
  const id=await linked();expect(await svc.view("foreign")).toBeNull();
  await expect(svc.disconnect("foreign",id)).rejects.toThrow("STALE_CONNECTION");
  await expect(svc.exchange("home",id,"public-sandbox-x")).rejects.toThrow("STALE_CONNECTION");
  await expect(svc.select("home",id,"unknown")).rejects.toThrow("STALE_CONNECTION");
  await expect(svc.sync("home",id)).rejects.toThrow("SELECT_ACCOUNT_FIRST");
  expect(provider.exchange).toHaveBeenCalledTimes(1);expect(provider.sync).not.toHaveBeenCalled();
});
it("restores encrypted access and the selected-account cursor after reopening",async()=>{
  const id=await linked();await svc.select("home",id,"A");await svc.sync("home",id);
  const {rows:[stored]}=await db.query<{token:string}>("SELECT token FROM connections");
  expect(stored.token).not.toContain(secret);expect(stored.token).toMatch(/^v1\./);
  const reopened=new PGlite({loadDataDir:await db.dumpDataDir()});
  try{
    const service=new Inbox(reopened,provider as unknown as SandboxProvider,key);
    await service.repair("home",id);expect(provider.createLink.mock.calls.at(-1)).toContain(secret);
    expect(provider.exchange).toHaveBeenCalledTimes(1);
    await service.sync("home",id);
    expect(provider.sync.mock.calls).toEqual([[secret,"A",null],[secret,"A","cursor"]]);
    const view=await service.view("home");expect(view?.records).toHaveLength(1);
    expect(JSON.stringify(view)).not.toContain(secret);expect(JSON.stringify(view)).not.toContain(stored.token);
    await service.disconnect("home",id);expect(provider.remove).toHaveBeenCalledWith(secret);
    expect(await service.view("home")).toBeNull();expect((await reopened.query("SELECT id FROM observations")).rows).toEqual([]);
  }finally{await reopened.close();}
},30000);
it("rejects a late worker after disconnect",async()=>{
  const id=await linked();await svc.select("home",id,"A");
  let unblock!:()=>void,started!:()=>void;
  const waiting=new Promise<void>(r=>{started=r;});
  provider.sync.mockImplementationOnce(async()=>{started();await new Promise<void>(r=>{unblock=r;});return page;});
  const work=svc.sync("home",id);await waiting;await svc.disconnect("home",id);unblock();
  await expect(work).rejects.toThrow("STALE_CONNECTION");expect(await svc.view("home")).toBeNull();
});
it("keeps an uncertain exchange blocked until explicitly cleared after its grace period",async()=>{
  const {id}=await svc.begin("home");
  provider.exchange.mockRejectedValueOnce(new SandboxError("NETWORK_OR_RESPONSE_ERROR"));
  await expect(svc.exchange("home",id,"public-sandbox-test")).rejects.toThrow();
  expect((await svc.view("home"))?.phase).toBe("exchange");
  await expect(svc.begin("home")).rejects.toThrow("STALE_CONNECTION");
  await expect(svc.clearUnconfirmed("home",id)).rejects.toThrow("STALE_CONNECTION");
  await db.query("UPDATE connections SET expires=0 WHERE id=$1",[id]);
  await svc.clearUnconfirmed("home",id);
  expect(await svc.view("home")).toBeNull();
  const connected=await linked();
  await expect(svc.clearUnconfirmed("home",connected)).rejects.toThrow("STALE_CONNECTION");
});
it("keeps the encrypted token for a failed revocation retry while disabling sync",async()=>{
  const id=await linked();provider.remove.mockRejectedValueOnce(new SandboxError("NETWORK_OR_RESPONSE_ERROR"));
  await expect(svc.disconnect("home",id)).rejects.toThrow();expect((await svc.view("home"))?.phase).toBe("disconnect");
  await expect(svc.sync("home",id)).rejects.toThrow();await svc.disconnect("home",id);expect(await svc.view("home")).toBeNull();
});
it("binds encrypted tokens to the connection and rejects tampering",()=>{
  const blob=sealToken(secret,key,"home:1");expect(openToken(blob,key,"home:1")).toBe(secret);
  expect(()=>openToken(blob,key,"foreign:1")).toThrow();expect(()=>openToken(blob,randomBytes(32),"home:1")).toThrow();
});
it("disables interactive Sandbox in hosted, production and remote-database processes",()=>{
  const env={NODE_ENV:"development",BANK_TOOLS_ENABLED:"1",BANK_LOCAL_LINK:"1",PGLITE_PATH:resolve(".pglite-bank-preview"),PLAID_SANDBOX_SECRET:"fake",PLAID_SANDBOX_CLIENT_ID:"id",BANK_LOCAL_KEY:"test"} as NodeJS.ProcessEnv;
  expect(sandboxInboxEnabled(env)).toBe(true);
  expect(sandboxInboxEnabled({...env,BANK_TOOLS_ENABLED:undefined})).toBe(false);
  for(const change of [{VERCEL:"1"},{NODE_ENV:"production"},{DATABASE_URL:"remote"},{PGLITE_PATH:"another"},{BANK_LOCAL_LINK:""}])expect(sandboxInboxEnabled({...env,...change} as NodeJS.ProcessEnv)).toBe(false);
});
