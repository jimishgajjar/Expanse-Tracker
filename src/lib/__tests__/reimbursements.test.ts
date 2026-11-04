import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { randomUUID } from "node:crypto";
import { reviewReimbursement, settleReimbursement, listReimbursements, reopenReimbursement, type SettlementPayment } from "../reimbursements";
import { confirmSettlement, loadSettlement } from "../reimbursement-actions";

const app = vi.hoisted(() => ({allowed:true,actor:"a",workspace:"home"}));
vi.mock("../session",()=>({getSession:async()=>({workspaceId:app.workspace,user:{id:app.actor}})}));
vi.mock("../local-personal-db",()=>({localPersonalDb:async()=>app.allowed?db:null}));
vi.mock("next/cache",()=>({revalidatePath:()=>{}}));

const db = new PGlite(), scope = {workspace:"home",actor:"a"};
const peer = {...scope,actor:"b"};
const record = {mode:"record",account:"bank",date:"2025-02-01",toAccount:null,checkedMatches:true} as const;
const make = async (payment:SettlementPayment,s=scope,other="b") =>
  ({id:randomUUID(),peer:other,version:(await reviewReimbursement(db,s,other)).version,payment});
const count = async (table:string) => (await db.query<{n:number}>(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n;
const open = async () => (await db.query("SELECT id FROM splits WHERE settled_at IS NULL ORDER BY id")).rows;

beforeAll(async () => {
  await migrate(drizzle(db),{migrationsFolder:"./drizzle"});
  await db.exec(`INSERT INTO users(id,email,password_hash) SELECT x,x||'@example.test','x' FROM unnest(ARRAY['a','b','viewer','third','out']) x;
    INSERT INTO workspaces(id,name,owner_id) VALUES ('home','H','a'),('personal:other','Private','b');
    INSERT INTO workspace_members(workspace_id,user_id,role) VALUES ('home','a','owner'),('home','b','member'),('home','third','member'),('home','viewer','viewer'),('personal:other','b','owner');
    INSERT INTO accounts(id,name,workspace_id) VALUES ('bank','Bank','home'),('cash','Cash','home'),('old','Archived','home'),('secret','Secret','personal:other');
    UPDATE accounts SET archived=true WHERE id='old';`);
},60000);
beforeEach(async () => {
  app.workspace="home";app.actor="a";app.allowed=true;
  await db.exec(`DELETE FROM reimbursements; DELETE FROM transaction_history; DELETE FROM refund_links; DELETE FROM splits; DELETE FROM transactions; DELETE FROM transfers;
    INSERT INTO splits(id,workspace_id,creditor_id,debtor_id,amount,note) VALUES
    ('s1','home','a','b',20.30,'Lunch'),('s2','home','b','a',0.31,'Coffee'),('other','home','b','third',19.99,'Other pair'),
    ('old','home','a','b',200,'Historical');
    UPDATE splits SET settled_at='2024-01-01' WHERE id='old';
    INSERT INTO transactions(id,workspace_id,account_id,type,amount,date,note) VALUES
    ('paid','home','bank','income',19.99,'2025-01-01','Payment'),('wrong','home','bank','expense',19.99,'2025-01-02','Other direction'),
    ('small','home','bank','income',10,'2025-01-03','Partial'),('later','home','bank','income',19.99,'2999-01-01','Future'),
    ('hidden','personal:other','secret','income',19.99,'2025-01-01','Private payment');
    INSERT INTO transfers(id,workspace_id,from_account_id,to_account_id,amount,date) VALUES ('transfer','home','bank','cash',19.99,'2025-01-02');`);
});
afterAll(async()=>{await db.close();});

it("links one reviewed payment, leaves cash and older IOUs intact, and safely reopens just that batch",async()=>{
  const review=await reviewReimbursement(db,scope,"b");
  expect(review.amount).toBe("19.99");
  expect(review.kind).toBe("income");
  expect(review.candidates.map(c=>c.key)).toEqual(["x:transfer","t:paid"]);
  expect(review.accounts.map(a=>a.id)).toEqual(["bank","cash"]);
  const request=await make({mode:"link",key:"t:paid"});
  expect((await confirmSettlement("home",request)).ok).toBe(true);
  await settleReimbursement(db,scope,request);
  expect(await count("transactions")).toBe(5); expect(await count("transaction_history")).toBe(0);
  expect(await open()).toEqual([{id:"other"}]);
  expect((await listReimbursements(db,peer))[0]).toMatchObject({id:request.id,amount:"19.99",paymentLabel:"Bank",count:2,method:"link"});
  for (const key of ["t:paid","t:wrong","t:hidden"]) {
    const otherPair=await make({mode:"link",key},peer,"third");
    await expect(settleReimbursement(db,peer,otherPair)).rejects.toThrow("available payment");
  }
  expect(await listReimbursements(db,{...scope,actor:"third"})).toEqual([]);
  await expect(reopenReimbursement(db,{...scope,actor:"third"},request.id)).rejects.toThrow("unavailable");
  await expect(db.query("DELETE FROM transactions WHERE id='paid'")).rejects.toThrow();
  await expect(db.query("UPDATE transactions SET amount=10 WHERE id='paid'")).rejects.toThrow("Reopen");
  await expect(db.exec("INSERT INTO refund_links(id,workspace_id,actor_id,credit_id,purchase_id,portions) VALUES ('f','home','a','paid','wrong','[]')")).rejects.toThrow("Reopen");
  await reopenReimbursement(db,peer,request.id);
  expect(await count("transactions")).toBe(5); expect(await open()).toHaveLength(3);
  await expect(settleReimbursement(db,scope,request)).rejects.toThrow("already");
  await expect(settleReimbursement(db,scope,{...request,id:randomUUID()})).rejects.toThrow("changed");
  const fresh=await make({mode:"link",key:"t:paid"});
  await settleReimbursement(db,scope,fresh);
  await reopenReimbursement(db,scope,request.id); // retry an older reversal
  expect(await open()).toEqual([{id:"other"}]);
});

it("creates one payment and its history together despite simultaneous confirmations and both participants attempting settlement",async()=>{
  const request=await make(record), opposite=await make(record,peer,"a");
  await expect(settleReimbursement(db,scope,{...request,payment:{...record,checkedMatches:false}})).rejects.toThrow("matching payments");
  await expect(settleReimbursement(db,scope,{...request,payment:{...record,account:"secret"}})).rejects.toThrow("active household");
  await expect(settleReimbursement(db,scope,{...request,payment:{...record,account:"old"}})).rejects.toThrow("active household");
  await expect(settleReimbursement(db,scope,{...request,payment:{...record,date:"2999-01-01"}})).rejects.toThrow("date");
  const results=await Promise.allSettled([settleReimbursement(db,scope,request),settleReimbursement(db,scope,request),settleReimbursement(db,peer,opposite)]);
  expect(results.map(r=>r.status)).toEqual(["fulfilled","fulfilled","rejected"]);
  expect(await count("reimbursements")).toBe(1); expect(await count("transactions")).toBe(6); expect(await count("transaction_history")).toBe(1);
  expect((await db.query("SELECT type,amount::text,account_id FROM transactions WHERE created_by='a'")).rows).toEqual([{type:"income",amount:"19.99",account_id:"bank"}]);
  await expect(settleReimbursement(db,scope,{...request,payment:{mode:"outside"}})).rejects.toThrow("already");
});

it("links or records a household transfer without adding income or spending and can settle outside the ledger",async()=>{
  const link=await make({mode:"link",key:"x:transfer"});
  await settleReimbursement(db,scope,link);
  await expect(db.query("UPDATE transfers SET to_account_id='bank' WHERE id='transfer'")).rejects.toThrow("Reopen");
  await expect(db.query("DELETE FROM transfers WHERE id='transfer'")).rejects.toThrow();
  await reopenReimbursement(db,scope,link.id);
  const transfer=await make({...record,toAccount:"cash"},peer,"a");
  await settleReimbursement(db,peer,transfer);
  expect(await count("transfers")).toBe(2);expect(await count("transactions")).toBe(5);
  expect((await listReimbursements(db,scope))[0].paymentLabel).toBe("Bank → Cash");
  await reopenReimbursement(db,scope,transfer.id);
  const outside=await make({mode:"outside"});
  await settleReimbursement(db,scope,outside);
  expect(await count("transfers")).toBe(2);expect(await count("transactions")).toBe(5);
});

it("rejects stale IOUs, changed candidate payments, private trackers, invalid roles and disabled previews",async()=>{
  const link=await make({mode:"link",key:"t:paid"});
  await db.query("UPDATE transactions SET note='Changed' WHERE id='paid'");
  await expect(settleReimbursement(db,scope,link)).rejects.toThrow("changed");
  const outdated=await make(record);
  await db.query("INSERT INTO splits(id,workspace_id,creditor_id,debtor_id,amount) VALUES ('new','home','a','b',1)");
  await expect(settleReimbursement(db,scope,outdated)).rejects.toThrow("changed");
  expect(await count("reimbursements")).toBe(0); expect(await count("transactions")).toBe(5);
  await expect(reviewReimbursement(db,scope,"out")).rejects.toThrow("belong");
  await expect(reviewReimbursement(db,{workspace:"personal:other",actor:"b"},"a")).rejects.toThrow("household");
  app.actor="viewer";expect((await confirmSettlement("home",link)).ok).toBe(false);
  app.actor="a";expect((await loadSettlement("other","b")).ok).toBe(false);
  app.allowed=false;expect((await confirmSettlement("home",link)).ok).toBe(false);
});

it("rolls back the payment, its history, and the settlement if closing the IOUs fails",async()=>{
  const outgoing=await make(record,peer,"a");
  await db.exec(`CREATE FUNCTION fail_fixture() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'fixture failure'; END; $$;
    CREATE TRIGGER fail_fixture BEFORE UPDATE ON splits FOR EACH ROW EXECUTE FUNCTION fail_fixture();`);
  try {
    await expect(settleReimbursement(db,peer,outgoing)).rejects.toThrow("fixture failure");
    expect(await count("transactions")).toBe(5);expect(await count("transaction_history")).toBe(0);
    expect(await count("reimbursements")).toBe(0);expect(await open()).toHaveLength(3);
  } finally {await db.exec("DROP TRIGGER fail_fixture ON splits; DROP FUNCTION fail_fixture()");}
  await settleReimbursement(db,peer,outgoing);
  expect((await db.query("SELECT type,amount::text FROM transactions WHERE created_by='b'")).rows).toEqual([{type:"expense",amount:"19.99"}]);
});
