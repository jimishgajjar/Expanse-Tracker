import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../db/schema";
import { createApiSession } from "../session";
import { openPersonalLedger } from "../personal-ledger";
import { VIEW_HEADER } from "../tracker-view";
import { GET as currentView } from "@/app/api/tracker-view/route";
import { GET, POST, DELETE } from "@/app/api/transaction-comments/[id]/route";
import { confirmAccountShare, previewAccountShare, receivedReport, receivedShares } from "../account-share-store";
import { deleteTransaction } from "../actions";
import type { CommentPage } from "../transaction-comments";
import * as notifications from "../notify";

const pg = new PGlite(), db = drizzle(pg,{schema});
const context = new AsyncLocalStorage<Headers>();
const preview = vi.hoisted(() => ({enabled:true}));
vi.mock("../db",()=>({getDb:async()=>db}));
vi.mock("../personal-preview",()=>({personalPreviewEnabled:()=>preview.enabled}));
vi.mock("next/headers",()=>({cookies:async()=>({get:()=>undefined}),headers:async()=>context.getStore()!}));
vi.mock("next/cache",()=>({revalidatePath:()=>{}}));

async function client(actor:string, workspace:string) {
  const token = await createApiSession(actor,workspace);
  const headers = new Headers({authorization:"Bearer "+token,host:"localhost",origin:"http://localhost","content-type":"application/json"});
  const {viewKey} = await context.run(headers,async()=>(await currentView()).json());
  headers.set(VIEW_HEADER,viewKey);
  function call(method:"GET"|"POST"|"DELETE",entry:string,body?:object,query="",custom=headers) {
    const req = new Request("http://localhost/api/transaction-comments/"+entry+query,{method,headers:custom,body:body?JSON.stringify(body):undefined});
    return context.run(custom,()=>({GET,POST,DELETE}[method])(req,{params:Promise.resolve({id:entry})}));
  }
  return {token,headers,call,actor,workspace};
}

let owner:Awaited<ReturnType<typeof client>>, editor:typeof owner, viewer:typeof owner, outsider:typeof owner, mine:typeof owner;
const newPost = (body:string) => ({body,requestId:randomUUID()});
const bodyOf = async (res:Response):Promise<CommentPage> => {expect(res.status).toBe(200);return res.json();};

beforeAll(async()=>{
  await migrate(db,{migrationsFolder:"./drizzle"});
  await pg.exec(`INSERT INTO users(id,email,name,password_hash)
    SELECT who,who||'@example.test',who,'unused' FROM unnest(ARRAY['owner','editor','viewer','outsider']) who;
    INSERT INTO workspaces(id,name,owner_id) VALUES('home','Household','owner'),('away','Other','outsider');
    INSERT INTO workspace_members(workspace_id,user_id,role) VALUES ('home','owner','owner'),('home','editor','member'),
      ('home','viewer','viewer'),('away','outsider','owner');
    INSERT INTO accounts(id,workspace_id,name) VALUES('shared','home','Chequing');
    INSERT INTO transactions(id,workspace_id,type,date,amount,account_id) SELECT id,'home','expense','2026-10-03',5,'shared'
      FROM unnest(ARRAY['rent','food','paged','protected']) id;`);
  const ledger=await openPersonalLedger(pg,{workspace:"home",actor:"editor"});
  await pg.query("INSERT INTO accounts(id,workspace_id,name) VALUES('private-account',$1,'Private')",[ledger]);
  await pg.query("INSERT INTO transactions(id,workspace_id,type,date,amount,account_id) VALUES('private',$1,'income','2026-10-03',9,'private-account')",[ledger]);
  [owner,editor,viewer,outsider,mine]=await Promise.all([client("owner","home"),client("editor","home"),client("viewer","home"),client("outsider","away"),client("editor",ledger)]);
},60000);
afterAll(()=>pg.close());

it("retries a post exactly once, shows attribution, and checks ownership and transaction on removal",async()=>{
  const input=newPost("  Paid together  ");
  const results=await Promise.all([editor.call("POST","rent",input),editor.call("POST","rent",input)]);
  expect(results.map(r=>r.status).sort()).toEqual([200,201]);
  const {id}=await results[0].json();
  const page=await bodyOf(await viewer.call("GET","rent"));
  expect(page).toMatchObject({canPost:false,personal:false,rows:[{id,body:"Paid together",author:"editor",canRemove:false}]});
  expect((await viewer.call("POST","rent",newPost("No"))).status).toBe(403);
  expect((await editor.call("POST","rent",{...input,body:"New text"})).status).toBe(409);
  const query="?comment="+id;
  expect((await viewer.call("DELETE","rent",undefined,query)).status).toBe(403);
  expect((await owner.call("DELETE","food",undefined,query)).status).toBe(404);
  expect((await bodyOf(await owner.call("GET","rent"))).rows[0].canRemove).toBe(true);
  expect((await editor.call("DELETE","rent",undefined,query)).status).toBe(200);
  expect((await editor.call("POST","rent",input)).status).toBe(409);
  expect((await bodyOf(await owner.call("GET","rent"))).rows).toEqual([]);
  expect((await pg.query("SELECT body,author_id,transaction_id FROM transaction_comments WHERE id=$1",[id])).rows)
    .toEqual([{body:null,author_id:null,transaction_id:null}]);
  const other = await (await editor.call("POST","rent",newPost("Remove from household thread"))).json();
  expect((await owner.call("DELETE","rent",undefined,"?comment="+other.id)).status).toBe(200);
});

it("uses the original transaction audience, even for someone who received a private account report",async()=>{
  const input=newPost("PRIVATE COMMENT MARKER");
  expect((await mine.call("POST","private",input)).status).toBe(201);
  expect((await bodyOf(await mine.call("GET","private"))).personal).toBe(true);
  const src={workspace:mine.workspace,actor:"editor",sessionId:mine.token};
  const choice={account:"private-account",recipient:"viewer",photos:false};
  const share=await previewAccountShare(pg,src,choice);
  await confirmAccountShare(pg,src,choice,share.token,share.expires);
  const recipient={workspace:"home",actor:"viewer",sessionId:viewer.token};
  const [copy]=await receivedShares(pg,recipient);
  expect((await receivedReport(pg,recipient,copy.id)).report.lines).toHaveLength(1);
  expect(JSON.stringify(await receivedReport(pg,recipient,copy.id))).not.toContain(input.body);
  for (const person of [owner,editor,viewer,outsider]) {
    expect((await person.call("GET","private")).status).toBe(404);
    expect((await person.call("POST","private",newPost("Guessed entry"))).status).toBe(404);
  }
  expect((await mine.call("GET","rent")).status).toBe(404);
  expect((await outsider.call("GET","rent")).status).toBe(404);
});

it("binds mentions to the posted comment and rejects outsiders, private mentions, self mentions and altered retries",async()=>{
  const queue=vi.spyOn(notifications,"notifyWorkspace").mockResolvedValue(0);
  try {
    const page=await bodyOf(await editor.call("GET","food"));
    expect(page.targets.map(p=>p.id).sort()).toEqual(["owner","viewer"]);
    expect((await bodyOf(await viewer.call("GET","food"))).targets).toEqual([]);
    expect((await bodyOf(await mine.call("GET","private"))).targets).toEqual([]);
    const post={...newPost("Please review"),mentions:["viewer"]};
    for (const recipient of ["outsider","editor"]) expect((await editor.call("POST","food",{...post,mentions:[recipient]})).status).toBe(400);
    expect((await mine.call("POST","private",post)).status).toBe(400);
    expect(queue).not.toHaveBeenCalled();
    const responses=await Promise.all([editor.call("POST","food",post),editor.call("POST","food",post)]);
    expect(responses.map(r=>r.status).sort()).toEqual([200,201]);
    expect(queue).toHaveBeenCalledTimes(1);
    expect(queue.mock.calls[0][1]).toMatchObject({topic:"mention",url:expect.stringContaining("thread=food")});
    expect((await bodyOf(await viewer.call("GET","food"))).rows[0].mentions).toEqual(["viewer"]);
    expect((await editor.call("POST","food",{...post,mentions:["owner"]})).status).toBe(409);
    const removed=await responses[0].json();
    expect((await editor.call("DELETE","food",undefined,"?comment="+removed.id)).status).toBe(200);
    expect((await pg.query("SELECT user_id FROM comment_mentions WHERE comment_id=$1",[removed.id])).rows).toEqual([]);
  } finally {queue.mockRestore();}
});

it("protects a transaction and account while comments exist and permits normal deletion after explicit removal",async()=>{
  const {id}=await (await owner.call("POST","protected",newPost("Keep the conversation"))).json();
  expect((await editor.call("DELETE","protected",undefined,"?comment="+id)).status).toBe(404);
  const removeEntry=()=>context.run(owner.headers,()=>deleteTransaction("protected"));
  expect(await removeEntry()).toMatchObject({ok:false,error:expect.stringContaining("comments")});
  await expect(pg.exec("DELETE FROM accounts WHERE id='shared'")).rejects.toThrow();
  expect((await owner.call("DELETE","protected",undefined,"?comment="+id)).status).toBe(200);
  expect(await removeEntry()).toMatchObject({ok:true});
  expect((await owner.call("GET","protected")).status).toBe(404);
});

it("pages tied timestamps without duplication and validates content and cursors",async()=>{
  await pg.query(`INSERT INTO transaction_comments(id,transaction_id,author_id,body,created_at)
    SELECT lpad(to_hex(i),64,'0'),'paged','owner','Line '||i,'2026-10-03 00:00:00.123456+00'
    FROM generate_series(1,27) i`);
  const first=await bodyOf(await viewer.call("GET","paged"));
  const query="?"+new URLSearchParams({at:first.next!.at,before:first.next!.id});
  const last=await bodyOf(await viewer.call("GET","paged",undefined,query));
  expect(first.rows).toHaveLength(25);
  expect(last.rows.map(r=>r.body)).toEqual(["Line 2","Line 1"]);
  expect(last.next).toBeNull();
  expect(new Set([...first.rows,...last.rows].map(r=>r.id)).size).toBe(27);
  expect((await editor.call("GET","paged",undefined,"?before=bad")).status).toBe(400);
  for(const input of [newPost("  "),newPost("a".repeat(1001)),{...newPost("test"),author:"owner"}])
    expect((await editor.call("POST","food",input)).status).toBe(400);
});

it("fails closed after a tracker switch, downgrade, removal or disabled preview and rejects cross-origin posts",async()=>{
  const cross=new Headers(editor.headers);cross.set("origin","http://other.test");
  expect((await editor.call("POST","food",newPost("Wrong origin"),"",cross)).status).toBe(403);
  const noView=new Headers(editor.headers);noView.delete(VIEW_HEADER);
  expect((await editor.call("POST","food",newPost("Missing view"),"",noView)).status).toBe(403);
  preview.enabled=false;
  try {expect((await owner.call("GET","rent")).status).toBe(404);} finally {preview.enabled=true;}
  await pg.query("UPDATE sessions SET workspace_id=$2 WHERE id=$1",[editor.token,mine.workspace]);
  expect((await editor.call("POST","food",newPost("Stale tab"))).status).toBe(401);
  await pg.query("UPDATE workspace_members SET role='viewer' WHERE workspace_id='home' AND user_id='editor'");
  expect((await mine.call("GET","private")).status).toBe(401);
  const downgraded=await client("editor",mine.workspace);
  expect((await bodyOf(await downgraded.call("GET","private"))).canPost).toBe(false);
  expect((await downgraded.call("POST","private",newPost("Stale access"))).status).toBe(403);
  await pg.query("DELETE FROM workspace_members WHERE workspace_id='home' AND user_id='editor'");
  expect((await downgraded.call("GET","private")).status).toBe(401);
});
