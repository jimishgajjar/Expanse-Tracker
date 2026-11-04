import {beforeEach,expect,it,vi} from "vitest";
const state=vi.hoisted(()=>({enabled:true,role:"owner",db:vi.fn()}));
vi.mock("../merchant-rule-feature",()=>({merchantRulesEnabled:()=>state.enabled}));
vi.mock("../workspace",()=>({getActiveWorkspace:async()=>({role:state.role,id:"home"})}));
vi.mock("../session",()=>({getSession:async()=>({sessionId:"fake-session",user:{id:"u"}})}));
vi.mock("../db",()=>({getDb:state.db}));
import {GET,POST} from "../../app/api/receipts/[id]/route";
const ctx={params:Promise.resolve({id:"test"})};
beforeEach(()=>{state.enabled=true;state.role="owner";vi.clearAllMocks();});
it("blocks hosted mode, read-only members and cross-origin writes before opening storage",async()=>{
  const url="http://127.0.0.1:3122/api/receipts/test";
  state.enabled=false;expect((await GET(new Request(url),ctx)).status).toBe(404);
  state.enabled=true;
  const post=(origin:string)=>POST(new Request(url,{method:"POST",headers:{origin,host:"127.0.0.1:3122"}}),ctx);
  expect((await post("http://elsewhere.invalid")).status).toBe(403);
  state.role="viewer";expect((await post("http://127.0.0.1:3122")).status).toBe(403);
  expect(state.db).not.toHaveBeenCalled();
});
it("rejects an unsigned image request and prevents shared caching",async()=>{
  const r=await GET(new Request("http://127.0.0.1:3122/api/receipts/test?file=other"),ctx);
  expect(r.status).toBe(403);expect(r.headers.get("cache-control")).toBe("private, no-store");
});
