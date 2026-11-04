import {afterAll,beforeAll,expect,it} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {drizzle} from "drizzle-orm/pglite";
import {migrate} from "drizzle-orm/pglite/migrator";
import {randomBytes} from "node:crypto";
import {Inbox,observationVersion} from "../plaid-sandbox/inbox";
import {SandboxReviews,type Decision} from "../plaid-sandbox/reviews";
import type {Observation,SandboxProvider} from "../plaid-sandbox/provider";

const db=new PGlite(),feed=new PGlite();
const base:Observation={transaction_id:"coffee",account_id:"checking",date:"2026-11-03",name:"Coffee",amount:4.25,iso_currency_code:"CAD",pending:false,pending_transaction_id:null};
const income={...base,transaction_id:"income",amount:-8,name:"Refund"};
const skipped={...base,transaction_id:"ignored"};
const provider={sync:async()=>({added:[base,income,skipped],modified:[],removed:[],next_cursor:"c",has_more:false,transactions_update_status:"HISTORICAL_UPDATE_COMPLETE"})};
const inbox=new Inbox(feed,provider as unknown as SandboxProvider,randomBytes(32));
let reviews:SandboxReviews;
const booking={account:"acct",currency:"CAD"};
const book:Decision={kind:"import",...booking,category:"cat",acknowledgeMatches:false};
const balance=async()=>(await db.query("SELECT count(*)::int AS entries,sum(CASE WHEN type='expense' THEN -amount ELSE amount END)::text AS net FROM transactions")).rows;
function decide(row:Observation,decision:Decision) {
  return inbox.withObservation("home","conn",row.transaction_id,actual=>reviews.decide("home","owner",actual,observationVersion(row),decision));
}
beforeAll(async()=>{
  await migrate(drizzle(db),{migrationsFolder:"./drizzle"});
  await db.exec(`INSERT INTO users(id,email,password_hash) VALUES ('owner','test@example.invalid','x');
    INSERT INTO workspaces(id,name,owner_id) VALUES ('home','Home','owner');
    INSERT INTO app_settings(workspace_id,currency_code) VALUES ('home','CAD');
    INSERT INTO accounts(id,workspace_id,name) VALUES ('acct','home','Checking'),('cash','home','Cash');
    INSERT INTO categories(id,workspace_id,name,kind) VALUES ('cat','home','Refund','income');
    INSERT INTO transactions(id,workspace_id,account_id,type,amount,date,note) VALUES
      ('original','home','acct','expense',4.25,'2026-11-01','Manual coffee'),('wrong','home','cash','expense',4.25,'2026-11-03','Cash coffee');`);
  reviews=new SandboxReviews(db);
  await inbox.view("home");
  // Use the actual selection, encrypted token, and sync paths with a synthetic provider.
  Object.assign(provider,{
    createLink:async()=>({link_token:"link-sandbox-test"}),exchange:async()=>({access_token:"access-sandbox-test",item_id:"item"}),
    accounts:async()=>({item:{item_id:"item"},accounts:[{account_id:"checking",type:"depository",subtype:"checking"}]})
  });
  const {id}=await inbox.begin("home");
  await feed.query("UPDATE connections SET id='conn' WHERE id=$1",[id]);
  await inbox.exchange("home","conn","public-sandbox-test");
  await inbox.select("home","conn","checking");await inbox.sync("home","conn");
},60000);
afterAll(async()=>{await db.close();await feed.close();});
it("keeps a match and ignore balance-neutral and books one income across concurrent clicks, sync and reopen",async()=>{
  const before=await balance();
  expect((await reviews.preview("home",base,booking)).candidates.map(c=>c.id)).toEqual(["original"]);
  await expect(decide(base,{kind:"match",...booking,target:"wrong"})).rejects.toThrow("REVIEW_CHANGED");
  await expect(decide(base,{...book,category:null})).rejects.toThrow("MATCH_AVAILABLE");
  await decide(base,{kind:"match",...booking,target:"original"});
  await decide(skipped,{kind:"ignore"});
  expect(await balance()).toEqual(before);
  const results=await Promise.allSettled([decide(income,book),decide(income,book)]);
  expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);
  expect(await balance()).toEqual([{entries:3,net:"-0.50"}]);
  await inbox.sync("home","conn");
  const reopened=new PGlite({loadDataDir:await db.dumpDataDir()});
  try{
    const saved=new SandboxReviews(reopened);
    expect((await saved.options("home","checking")).receipts.map(r=>r.decision).sort()).toEqual(["ignore","import","match"]);
    await expect(saved.decide("home","owner",income,observationVersion(income),book)).rejects.toThrow("ALREADY_REVIEWED");
  }finally{await reopened.close();}
},60000);
it("checks observation ownership, stale amounts, pending status and settled currency",async()=>{
  await expect(inbox.withObservation("foreign","conn","coffee",async()=>true)).rejects.toThrow("STALE_CONNECTION");
  await expect(decide({...base,amount:999},{kind:"ignore"})).rejects.toThrow("REVIEW_CHANGED");
  await expect(reviews.preview("home",{...base,pending:true},booking)).rejects.toThrow("UNBOOKABLE");
  const fx={...base,iso_currency_code:"USD"};
  await expect(reviews.preview("home",fx,booking)).rejects.toThrow("SETTLED_AMOUNT_REQUIRED");
  expect((await reviews.preview("home",fx,{...booking,settled:"7.60"})).amount).toBe("7.60");
});
