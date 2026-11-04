import {it,expect,vi} from "vitest";
import {SandboxProvider,SandboxError,type SandboxPage} from "../plaid-sandbox/provider";
import {observe,type Feed} from "../plaid-sandbox/observe";
import {checkSandbox} from "../plaid-sandbox/check";

const account="sample-checking";
const row=(id:string)=>({account_id:account,transaction_id:id,date:"2026-10-12",amount:2.5,
  iso_currency_code:"CAD",pending:false,pending_transaction_id:null});
const page=(extra:Partial<SandboxPage>={}):SandboxPage=>({added:[],modified:[],removed:[],
  next_cursor:"new",has_more:false,transactions_update_status:"HISTORICAL_UPDATE_COMPLETE",...extra});
const feed=():Feed=>({cursor:"committed",accountId:account,rows:new Map([["pending",{...row("pending"),pending:true}]])});

it("abandons interrupted pages and restarts at the committed account cursor",async()=>{
  const old=feed(),read=vi.fn()
    .mockResolvedValueOnce(page({added:[row("discard-me")],next_cursor:"partial",has_more:true}))
    .mockRejectedValueOnce(new SandboxError("TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION"))
    .mockResolvedValueOnce(page({added:[{...row("posted"),pending_transaction_id:"pending"}],removed:[{transaction_id:"pending"}],next_cursor:"valid",has_more:true}))
    .mockResolvedValueOnce(page({modified:[{...row("posted"),amount:3.25}]}));
  const {feed:result}=await observe(old,read);
  expect(read.mock.calls).toEqual(["committed","partial","committed","valid"].map(c=>[account,c]));
  expect([...result.rows.keys()]).toEqual(["posted"]);expect(result.rows.get("posted")?.amount).toBe(3.25);
  expect(old.cursor).toBe("committed");expect([...old.rows.keys()]).toEqual(["pending"]);
  const retry=await observe(result,async()=>page());expect(retry.feed).toEqual(result);
});
it.each(["wrong account","foreign removal","timeout","loop","not ready","restarts exhausted"])("keeps the previous feed on %s",async which=>{
  const old=feed(),read=vi.fn(async()=>{
    if(which==="wrong account")return page({added:[{...row("x"),account_id:"other"}]});
    if(which==="foreign removal")return page({removed:[{transaction_id:"pending",account_id:"other"}]});
    if(which==="loop")return page({next_cursor:"loop",has_more:true});
    if(which==="not ready")return page({next_cursor:"",transactions_update_status:"NOT_READY"});
    throw new SandboxError(which==="timeout"?"NETWORK_OR_RESPONSE_ERROR":"TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION");
  });
  await expect(observe(old,read)).rejects.toThrow();
  expect(old).toEqual(feed());
  if(which==="restarts exhausted")expect(read).toHaveBeenCalledTimes(3);
});
function fixture(fault=""){
  const requests:{path:string;body:Record<string,unknown>}[]=[];
  let syncs=0;
  const send:typeof fetch=async(url,init)=>{
    const dest=new URL(String(url)),body=JSON.parse(String(init?.body));requests.push({path:dest.pathname,body});
    expect(dest.origin).toBe("https://sandbox.plaid.com");expect(init?.redirect).toBe("error");
    expect(new Headers(init?.headers).get("PLAID-SECRET")).toBe("fixture-secret");
    if(dest.pathname===fault)return Response.json({error_code:"PRIVATE-fixture-secret",error_message:"private memo"},{status:400});
    switch(dest.pathname){
      case "/link/token/create":return Response.json({link_token:"link-sandbox-fake"});
      case "/sandbox/public_token/create":return Response.json({public_token:"public-sandbox-fake"});
      case "/item/public_token/exchange":return Response.json({access_token:"access-sandbox-fake",item_id:"item"});
      case "/accounts/get":return Response.json({item:{item_id:"item"},accounts:[{account_id:"other",type:"credit",subtype:"credit card"},{account_id:account,type:"depository",subtype:"checking"}]});
      case "/transactions/sync":
        syncs++;
        if(syncs===1||fault==="no data")return Response.json(page({transactions_update_status:"NOT_READY",next_cursor:""}));
        if(fault==="bad data")return Response.json({private:"fixture-secret"});
        return Response.json(page(syncs===2?{added:[row("x")]}:{}));
      case "/item/remove":return Response.json({request_id:"fake"});
      default:throw Error("unexpected request");
    }
  };
  return {p:new SandboxProvider({clientId:"fixture",secret:"fixture-secret"},send),requests};
}
it("checks create/update Link, exchanges once, scopes every sync, and discards tokens",async()=>{
  const {p,requests}=fixture();const receipt=await checkSandbox(p,async()=>{});
  expect(receipt).toMatchObject({selectedAccounts:1,observedTransactions:1,itemRemoved:true});
  const links=requests.filter(r=>r.path==="/link/token/create");
  expect(links[0].body).toMatchObject({country_codes:["CA"],products:["transactions"]});
  expect(links[1].body.user).toEqual(links[0].body.user);
  expect(links[1].body.access_token).toBe("access-sandbox-fake");expect(links[1].body.products).toBeUndefined();
  expect(requests.filter(r=>r.path==="/item/public_token/exchange")).toHaveLength(1);
  const syncs=requests.filter(r=>r.path==="/transactions/sync");
  expect(syncs.map(r=>r.body.options)).toEqual(Array(3).fill({account_id:account}));
  expect(syncs.every(r=>!("account_id" in r.body))).toBe(true);
  expect(syncs.map(r=>r.body.cursor)).toEqual([undefined,undefined,"new"]);
  expect(requests.at(-1)?.path).toBe("/item/remove");expect(JSON.stringify(receipt)).not.toContain("fake");
});
it.each([["/accounts/get","PROVIDER_HTTP_400"],["bad data","UNEXPECTED_PROVIDER_RESPONSE"],["no data","TEST_TRANSACTIONS_NOT_AVAILABLE"],["/item/remove","CLEANUP_UNCONFIRMED"]])("attempts cleanup without exposing a response on %s",async(fault,message)=>{
  const {p,requests}=fixture(fault);await expect(checkSandbox(p,async()=>{})).rejects.toThrow(message);
  expect(requests.at(-1)?.path).toBe("/item/remove");
});
it("never recreates an Item on an ambiguous exchange result",async()=>{
  const {p,requests}=fixture("/item/public_token/exchange");await expect(checkSandbox(p)).rejects.toThrow("EXCHANGE_UNCONFIRMED");
  expect(requests.map(r=>r.path)).toEqual(["/link/token/create","/sandbox/public_token/create","/item/public_token/exchange"]);
});
