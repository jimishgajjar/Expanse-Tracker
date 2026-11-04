import {afterAll,beforeAll,expect,it} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {drizzle} from "drizzle-orm/pglite";
import {migrate} from "drizzle-orm/pglite/migrator";
import {applyBulk,bulkTools,previewBulk,undoBulk} from "../bulk-edits";

let db:PGlite;
const owner={workspace:"home",actor:"me",name:"Demo"};
const command=(ids:string[],kind:"category"|"addTag"|"removeTag",id:string)=>({ids,operation:{kind,id},batch:crypto.randomUUID()});
const ledger=async()=>(await db.query("SELECT id,amount::text,date::text,account_id FROM transactions ORDER BY id")).rows;
beforeAll(async()=>{
  db=new PGlite();await migrate(drizzle(db),{migrationsFolder:"./drizzle"});
  await db.exec(`INSERT INTO users(id,email,password_hash) VALUES('me','a@example.invalid','x'),('v','b@example.invalid','x');
    INSERT INTO workspaces(id,name,owner_id) VALUES('home','Home','me'),('other','Other','me');
    INSERT INTO workspace_members(workspace_id,user_id,role) VALUES('home','me','owner'),('home','v','viewer');
    INSERT INTO accounts(id,name,workspace_id) VALUES('bank','Bank','home');
    INSERT INTO categories(id,name,workspace_id,kind) VALUES('food','Food','home','expense'),('gas','Gas','home','expense');
    INSERT INTO tags(id,name,workspace_id) VALUES('old','Old','home'),('new','New','home'),('foreign','Other','other');
    INSERT INTO transactions(id,workspace_id,type,amount,date,account_id,category_id) VALUES
      ('one','home','expense',10,'2026-11-01','bank','food'),('two','home','expense',20,'2026-11-01','bank','food'),
      ('income','home','income',50,'2026-11-01','bank',null),('split','home','expense',4,'2026-11-01','bank',null);
    INSERT INTO purchase_allocations VALUES('split','food',2),('split','gas',2);
    INSERT INTO transaction_tags VALUES('one','old');`);
},60000);
afterAll(()=>db.close());
it("skips split and mismatched categories, rejects stale previews, replays only once, and selectively undoes",async()=>{
  const original=await ledger(),cmd=command(["one","two","income","split"],"category","gas");
  const old=await previewBulk(db,owner,cmd);
  expect(old.rows.filter(r=>r.skip).map(r=>r.skip)).toEqual(["Different transaction type","Split purchase"]);
  await db.query("UPDATE transactions SET note='New note' WHERE id='one'");
  await expect(applyBulk(db,owner,{...cmd,key:old.key})).rejects.toThrow("changed after preview");
  const {key}=await previewBulk(db,owner,cmd);
  await Promise.all([applyBulk(db,owner,{...cmd,key}),applyBulk(db,owner,{...cmd,key})]);
  expect((await bulkTools(db,owner)).batches[0].count).toBe(2);
  await db.query("UPDATE transactions SET note='Later edit' WHERE id='two'");
  const result=await undoBulk(db,owner,cmd.batch);
  expect(result.map(r=>r.status)).toEqual(["Restored","Skipped · edited or deleted"]);
  expect((await undoBulk(db,owner,cmd.batch))[0].status).toBe("Already restored");
  await applyBulk(db,owner,{...cmd,key});
  await expect(applyBulk(db,owner,{...cmd,key,ids:["one"]})).rejects.toThrow("already used");
  expect((await db.query("SELECT category_id FROM transactions WHERE id IN ('one','two') ORDER BY id")).rows).toEqual([{category_id:"food"},{category_id:"gas"}]);
  expect(await ledger()).toEqual(original);
});
it("preserves unrelated tags and refuses undo after an intervening audited edit even if values match again",async()=>{
  const add=command(["one","split"],"addTag","new");
  const {key}=await previewBulk(db,owner,add);
  await applyBulk(db,owner,{...add,key});
  const remove=command(["one"],"removeTag","new");
  await applyBulk(db,owner,{...remove,key:(await previewBulk(db,owner,remove)).key});
  await undoBulk(db,owner,remove.batch);
  expect((await undoBulk(db,owner,add.batch)).map(r=>r.status)).toEqual(["Skipped · edited or deleted","Restored"]);
  expect((await db.query("SELECT tag_id FROM transaction_tags WHERE transaction_id='one' ORDER BY tag_id")).rows).toEqual([{tag_id:"new"},{tag_id:"old"}]);
});
it("enforces batch limits, membership and workspace references",async()=>{
  const cmd=command(["one"],"addTag","foreign");
  await expect(previewBulk(db,owner,cmd)).rejects.toThrow("unavailable");
  await expect(previewBulk(db,{...owner,actor:"v"},cmd)).rejects.toThrow("access");
  await expect(undoBulk(db,{...owner,workspace:"other"},cmd.batch)).rejects.toThrow("access");
  await expect(previewBulk(db,owner,{...cmd,ids:Array.from({length:26},(_,i)=>String(i))})).rejects.toThrow();
});
it("rolls back the entire batch if a later audit row cannot be saved",async()=>{
  const cmd=command(["one","two"],"addTag","old");
  // Ensure both rows would change. The second receipt simulates a failed write.
  await db.exec("DELETE FROM transaction_tags WHERE tag_id='old'");
  const {key}=await previewBulk(db,owner,cmd);
  await db.exec("ALTER TABLE transaction_history ADD CHECK (transaction_id <> 'two') NOT VALID");
  await expect(applyBulk(db,owner,{...cmd,key})).rejects.toThrow();
  expect((await db.query("SELECT tag_id FROM transaction_tags WHERE tag_id='old'")).rows).toHaveLength(0);
  expect((await bulkTools(db,owner)).batches.some(b=>b.id===cmd.batch)).toBe(false);
});
