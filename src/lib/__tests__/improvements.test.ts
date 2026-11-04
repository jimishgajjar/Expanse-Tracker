import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { sql } from "drizzle-orm";
import * as schema from "../db/schema";
import type { AppDb } from "../db";
import { activityFilterSchema, queryActivity } from "../activity-query";
import { editWithHistory } from "../transaction-edit";
import { statementComparison } from "../reconciliation";
import { decryptBackup, encryptBackup } from "../backup-envelope";

let client:PGlite;
let db:AppDb;
beforeAll(async () => {
  client = new PGlite();
  const local = drizzle(client,{schema});
  await migrate(local,{migrationsFolder:"./drizzle"});
  db = local as unknown as AppDb;
  await client.exec(`INSERT INTO users(id,email,password_hash) VALUES ('u','u@example.test','x');
    INSERT INTO workspaces(id,name,owner_id) VALUES ('w','Home','u'),('foreign','Other','u');
    INSERT INTO workspace_members(workspace_id,user_id,role) VALUES ('w','u','owner');
    INSERT INTO accounts(id,workspace_id,name) VALUES ('a','w','Bank'),('b','w','Cash'),('x','foreign','Private');
    INSERT INTO categories(id,workspace_id,name,kind) VALUES ('food','w','Food','expense');
    INSERT INTO tags(id,workspace_id,name) VALUES ('tag','w','Holiday');
    INSERT INTO transactions(id,workspace_id,type,amount,date,note,account_id,category_id)
      SELECT 't'||n,'w','expense',10,'2026-10-01','Coffee','a','food' FROM generate_series(1,60) n;
    INSERT INTO transactions(id,workspace_id,type,amount,date,account_id) VALUES ('salary','w','income',1000,'2026-10-02','a'),('secret','foreign','income',99999,'2026-10-02','x');
    INSERT INTO transfers(id,workspace_id,from_account_id,to_account_id,amount,date) VALUES ('move','w','a','b',50,'2026-10-03');
    INSERT INTO transaction_tags(transaction_id,tag_id) VALUES ('t1','tag');`);
},60000);
afterAll(async () => {await client?.close();});
const filters = (patch = {}) => activityFilterSchema.parse({start:"2026-10-01",end:"2026-11-01",...patch});

describe("server activity pagination", () => {
  it("returns only one page, keeps exact full-filter totals and excludes other workspaces", async () => {
    const result = await queryActivity(db,"w",filters());
    expect(result.total).toBe(62);
    expect(result.income).toBe(1000);
    expect(result.expense).toBe(600);
    expect(result.transferred).toBe(50);
    expect(result.transactions.length+result.transfers.length).toBe(25);
    expect(result.transactions.some(t => t.id === "secret")).toBe(false);
  });
  it("has stable disjoint pages, clamps out-of-range pages, searches tags and excludes transfers when a category is selected", async () => {
    const first = await queryActivity(db,"w",filters({type:"expense"}));
    const second = await queryActivity(db,"w",filters({type:"expense",page:2}));
    expect(second.transactions.every(t => !first.transactions.some(a => a.id===t.id))).toBe(true);
    expect((await queryActivity(db,"w",filters({page:999}))).page).toBe(3);
    const tagged = await queryActivity(db,"w",filters({search:"holiday"}));
    expect(tagged.transactions.map(t=>t.id)).toEqual(["t1"]);
    expect(tagged.transactions[0]).toMatchObject({
      type: "expense", amount: 10, note: "Coffee", accountId: "a", categoryId: "food",
      account: { name: "Bank" }, category: { name: "Food" },
      tags: [{ id: "tag", name: "Holiday" }],
    });
    expect((await queryActivity(db,"w",filters({category:"food"}))).transferred).toBe(0);
  });
  it("hydrates only the selected page without changing transfer details or empty-filter totals", async () => {
    const transfers = await queryActivity(db,"w",filters({type:"transfer"}));
    expect(transfers.transactions).toEqual([]);
    expect(transfers.transfers).toEqual([{id:"move",amount:50,date:"2026-10-03",note:"",fromAccountId:"a",toAccountId:"b"}]);
    expect(transfers.income).toBe(0);
    expect(transfers.expense).toBe(0);
    const empty = await queryActivity(db,"w",filters({search:"no matching fixture"}));
    expect(empty).toMatchObject({total:0,income:0,expense:0,transferred:0,pages:1,page:1,transactions:[],transfers:[]});
  });
});

describe("atomic future edit history", () => {
  it("captures the editor and exact previous values including tags", async () => {
    expect(await editWithHistory(db,"w","t1",{id:"u",name:"Test person"},{amount:12,note:"Lunch"},[])).toBe(true);
    const result = await db.select().from(schema.transactionHistory);
    expect(result).toHaveLength(1);
    expect(Number(result[0].before.amount)).toBe(10);
    expect(Number(result[0].after.amount)).toBe(12);
    expect(result[0].before.tag_ids).toEqual(["tag"]);
    expect(result[0].after.tag_ids).toEqual([]);
    expect(result[0].actorName).toBe("Test person");
    expect(await editWithHistory(db,"foreign","t1",{id:"u",name:"Test"},{amount:500})).toBe(false);
  });
  it("rolls back the financial edit if recording history fails", async () => {
    await client.exec("CREATE FUNCTION reject_test_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'history unavailable'; END $$; CREATE TRIGGER reject_test_history BEFORE INSERT ON transaction_history FOR EACH ROW EXECUTE FUNCTION reject_test_history()");
    try {
      await expect(editWithHistory(db,"w","t2",{id:"u",name:"Test"},{amount:500})).rejects.toThrow();
    } finally {
      await client.exec("DROP TRIGGER reject_test_history ON transaction_history; DROP FUNCTION reject_test_history()");
    }
    const row = await db.execute(sql`SELECT amount FROM transactions WHERE id='t2'`);
    expect(Number(row.rows[0].amount)).toBe(10);
  });
  it("does not record no-op edits", async () => {
    await editWithHistory(db,"w","t2",{id:"u",name:"Test"},{amount:10});
    expect(await db.select().from(schema.transactionHistory)).toHaveLength(1);
  });
});

it("reconciles inclusive statement dates with transfer direction and cents", () => {
  expect(statementComparison(0.1,[{date:"2026-10-01",type:"income",amount:0.2},{date:"2026-10-03",type:"expense",amount:1}],[],"a","2026-10-02",0.3).matched).toBe(true);
  expect(statementComparison(100,[],[{date:"2026-10-01",amount:25,fromAccountId:"a",toAccountId:"b"}],"a","2026-10-01",80)).toEqual({ledger:75,difference:5,matched:false});
});

it("encrypts backups and rejects wrong keys or tampering", () => {
  const key = "ab".repeat(32);
  const saved = encryptBackup({private:"financial records"},key);
  expect(saved.toString()).not.toContain("financial records");
  expect(decryptBackup(saved,key)).toEqual({private:"financial records"});
  expect(() => decryptBackup(saved,"cd".repeat(32))).toThrow();
  saved[saved.length-1] ^= 1;
  expect(() => decryptBackup(saved,key)).toThrow();
});
