import {beforeEach,expect,it,vi} from "vitest";
const auth=vi.hoisted(()=>({enabled:true,role:"owner",origin:"http://127.0.0.1:3122",host:"127.0.0.1:3122",view:vi.fn(async()=>null),begin:vi.fn()}));
vi.mock("next/headers",()=>({headers:async()=>new Headers({origin:auth.origin,host:auth.host})}));
vi.mock("../workspace",()=>({getActiveWorkspace:async()=>({role:auth.role,id:"home"})}));
vi.mock("../plaid-sandbox/config",()=>({sandboxInboxEnabled:()=>auth.enabled}));
vi.mock("../plaid-sandbox/local",()=>({localInbox:()=>({view:auth.view,begin:auth.begin})}));
import {bankCommand} from "../../app/bank-inbox/actions";
beforeEach(()=>{Object.assign(auth,{enabled:true,role:"owner",origin:"http://127.0.0.1:3122",host:"127.0.0.1:3122"});vi.clearAllMocks();});
it.each(["viewer","member","other workspace","remote origin","foreign host","disabled"])("blocks %s before issuing Link or disclosing the inbox",async mode=>{
  if(mode==="viewer"||mode==="member")auth.role=mode;
  if(mode==="remote origin")auth.origin="https://example.invalid";
  if(mode==="foreign host"){auth.host="elsewhere.invalid";auth.origin="http://elsewhere.invalid";}
  if(mode==="disabled")auth.enabled=false;
  const ws=mode==="other workspace"?"other":"home";
  expect((await bankCommand(ws,{op:"begin"})).ok).toBe(false);expect((await bankCommand(ws,{op:"refresh"})).ok).toBe(false);
  expect(auth.begin).not.toHaveBeenCalled();expect(auth.view).not.toHaveBeenCalled();
});
it("allows an owner to reopen their saved local inbox",async()=>{
  expect(await bankCommand("home",{op:"refresh"})).toEqual({ok:true,view:null,options:null});expect(auth.view).toHaveBeenCalledWith("home");
});
