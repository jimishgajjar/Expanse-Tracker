import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { openPersonalLedger } from "../personal-ledger";
import { deletePersonalLedger } from "../delete-personal-ledger";
import type { HouseholdDb } from "../household-db";

const pg = new PGlite();
const auth = vi.hoisted(() => ({ actor: "one", workspace: "", enabled: true, signedIn: true }));
vi.mock("../session", () => ({ getSession: async () => auth.signedIn ? { user: { id: auth.actor } } : null }));
vi.mock("../workspace", () => ({ getActiveWorkspaceId: async () => auth.workspace }));
vi.mock("../household-features", () => ({ householdFeaturesEnabled: () => auth.enabled }));
vi.mock("../household-db", () => ({ getHouseholdDb: async () => pg }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { deletePrivateTracker } from "../personal-actions";

const name = "My private accounts · Home";
const scope = (workspace: string, actor = "one") => ({ workspace, actor });
let mine: string, other: string;
beforeAll(async () => {
  await migrate(drizzle(pg), { migrationsFolder: "./drizzle" });
  await pg.exec(`INSERT INTO users(id,email,password_hash) SELECT id,id||'@example.test','unused'
    FROM unnest(ARRAY['admin','one','two','out']) id;
    INSERT INTO workspaces(id,name,owner_id) VALUES ('home','Home','admin');
    INSERT INTO workspace_members(workspace_id,user_id,role) VALUES ('home','admin','owner'),('home','one','member'),('home','two','member');
    INSERT INTO app_settings(workspace_id,currency_code) VALUES ('home','CAD');
    INSERT INTO accounts(id,workspace_id,name,initial_balance) VALUES ('joint','home','Joint',1234);
    INSERT INTO transactions(id,workspace_id,type,date,amount,account_id) VALUES ('home-tx','home','income','2026-11-14',9,'joint');`);
  mine = await openPersonalLedger(pg, scope("home"));
  other = await openPersonalLedger(pg, scope("home", "two"));
  await pg.query("INSERT INTO accounts(id,workspace_id,name,initial_balance) VALUES ('private',$1,'Private',100),('private-cash',$1,'Cash',0),('other',$2,'Other',200)", [mine, other]);
  await pg.query("INSERT INTO categories(id,workspace_id,name,kind) VALUES ('category',$1,'Shopping','expense')", [mine]);
  await pg.query("INSERT INTO transactions(id,workspace_id,type,date,amount,account_id,category_id) VALUES ('purchase',$1,'expense','2026-11-14',10,'private','category'),('refund',$1,'income','2026-11-14',2,'private',null)", [mine]);
  await pg.exec("INSERT INTO purchase_allocations(transaction_id,category_id,amount) VALUES ('purchase','category',10)");
  await pg.query("INSERT INTO refund_links(id,workspace_id,actor_id,credit_id,purchase_id,portions) VALUES ('refund-link',$1,'one','refund','purchase','[{\"categoryId\":\"category\",\"amount\":\"2.00\"}]')", [mine]);
  await pg.query("INSERT INTO transfers(id,workspace_id,from_account_id,to_account_id,amount,date) VALUES ('move',$1,'private','private-cash',5,'2026-11-14')", [mine]);
  await pg.exec("INSERT INTO receipt_images(transaction_id,id,jpeg,bytes) VALUES ('purchase','receipt','fixture',7); INSERT INTO transaction_comments(id,transaction_id,author_id,body) VALUES ('comment','purchase','one','Private note')");
  await pg.query("INSERT INTO recurring(id,workspace_id,type,amount,account_id,frequency,next_date) VALUES ('bill',$1,'expense',3,'private','monthly','2026-12-01')", [mine]);
  await pg.query("INSERT INTO goals(id,workspace_id,name,target_amount) VALUES ('goal',$1,'Trip',100)", [mine]);
  await pg.query("INSERT INTO goal_reservations(id,workspace_id,actor_id,goal_id,account_id,delta) VALUES ('reserved',$1,'one','goal','private',5)", [mine]);
  await pg.query("INSERT INTO monthly_plans(workspace_id,category_id,month,amount,rollover) VALUES ($1,'category','2026-11-01',20,false)", [mine]);
  await pg.query("INSERT INTO finance_accounts(workspace_id,account_id,role,reviewed_balance,adjustment,interpretation,reviewer) VALUES ($1,'private','cash',100,0,'signed','one')", [mine]);
  await pg.query("INSERT INTO finance_books(workspace_id,currency) VALUES ($1,'CAD')", [mine]);
  await pg.query("INSERT INTO finance_operations(id,workspace_id,actor,fingerprint) VALUES ('operation',$1,'one','fixture')", [mine]);
  await pg.query(`INSERT INTO finance_bookings(id,workspace_id,operation_id,transaction_id,kind,original_amount,original_currency,
    original_rate,account_amount,account_currency,reporting_amount,reporting_currency,booked_rate,source,as_of)
    VALUES ('booking',$1,'operation','purchase','purchase',10,'CAD',1,10,'CAD',10,'CAD',1,'fixture',now())`, [mine]);
  await pg.query("INSERT INTO account_shares(id,ledger_id,account_id,household_id,owner_id,recipient_id,revision,report) VALUES ('share',$1,'private','home','one','two','1','{}')", [mine]);
  await pg.query("INSERT INTO sessions(id,user_id,workspace_id,expires_at) VALUES ('personal-session','one',$1,'2030-01-01'),('shared-session','one','home','2030-01-01')", [mine]);
}, 60000);
afterAll(() => pg.close());

async function householdSnapshot() {
  const rows = [];
  for (const table of ["workspaces", "workspace_members", "accounts", "transactions", "transfers", "app_settings"]) {
    rows.push((await pg.query(`SELECT * FROM ${table} WHERE ${table === "workspaces" ? "id" : "workspace_id"}='home'`)).rows);
  }
  rows.push((await pg.query("SELECT * FROM accounts WHERE id='other'")).rows);
  rows.push((await pg.query("SELECT * FROM users ORDER BY id")).rows);
  return rows;
}

it("rejects household deletion, another member's tracker, outsiders, and incorrect confirmation", async () => {
  const before = await householdSnapshot();
  await expect(deletePersonalLedger(pg, scope("home"), "Home")).rejects.toThrow("Only a private");
  for (const actor of ["admin", "two", "out"]) {
    await expect(deletePersonalLedger(pg, scope(mine, actor), name)).rejects.toThrow("own private tracker");
  }
  await expect(deletePersonalLedger(pg, scope(mine), "DELETE")).rejects.toThrow("full tracker name");
  expect(await householdSnapshot()).toEqual(before);
});

it("rejects a downgraded or revoked owner without deleting any content", async () => {
  await pg.exec("UPDATE workspace_members SET role='viewer' WHERE workspace_id='home' AND user_id='one'");
  await expect(deletePersonalLedger(pg, scope(mine), name)).rejects.toThrow("editing access");
  await pg.exec("DELETE FROM workspace_members WHERE workspace_id='home' AND user_id='one'");
  await expect(deletePersonalLedger(pg, scope(mine), name)).rejects.toThrow("editing access");
  await pg.exec("INSERT INTO workspace_members(workspace_id,user_id,role) VALUES ('home','one','member')");
  expect((await pg.query("SELECT amount FROM transactions WHERE id='purchase'")).rows).toEqual([{ amount: "10.00" }]);
});

it("validates the active tracker and authentication at the action boundary", async () => {
  auth.workspace = "home";
  expect(await deletePrivateTracker({ workspace: mine, confirmation: name })).toMatchObject({ ok: false });
  auth.workspace = mine; auth.signedIn = false;
  expect(await deletePrivateTracker({ workspace: mine, confirmation: name })).toMatchObject({ ok: false });
  auth.signedIn = true; auth.enabled = false;
  expect(await deletePrivateTracker({ workspace: mine, confirmation: name })).toMatchObject({ ok: false });
  auth.enabled = true;
  expect(await deletePrivateTracker({ workspace: mine, confirmation: "wrong" })).toMatchObject({ ok: false });
});

it("refuses a legacy cross-tracker reference instead of cascading into household data", async () => {
  await pg.query("INSERT INTO transactions(id,workspace_id,type,date,amount,account_id) VALUES ('legacy','home','expense','2026-11-14',1,'private')");
  const before = await householdSnapshot();
  await expect(deletePersonalLedger(pg, scope(mine), name)).rejects.toThrow("another tracker references");
  expect(await householdSnapshot()).toEqual(before);
  expect((await pg.query("SELECT id FROM receipt_images")).rows).toEqual([{ id: "receipt" }]);
  await pg.exec("DELETE FROM transactions WHERE id='legacy'");
});

it("rolls back attachment cleanup if any part of deletion fails", async () => {
  const broken: HouseholdDb = { query: (sql, params) => pg.query(sql, params), transaction: work => pg.transaction(tx => work({
    exec: sql => tx.exec(sql), query: (sql, params) => {
      if (sql.startsWith("DELETE FROM workspaces")) throw new Error("Simulated failure");
      return tx.query(sql, params);
    },
  })) };
  await expect(deletePersonalLedger(broken, scope(mine), name)).rejects.toThrow("Simulated failure");
  expect((await pg.query("SELECT id FROM receipt_images")).rows).toEqual([{ id: "receipt" }]);
  expect((await pg.query("SELECT id FROM transaction_comments")).rows).toEqual([{ id: "comment" }]);
  expect((await pg.query("SELECT id FROM finance_bookings")).rows).toEqual([{ id: "booking" }]);
});

it("deletes the confirmed private tracker and its content, preserves other balances, and permits a fresh empty tracker", async () => {
  const before = await householdSnapshot();
  auth.workspace = mine;
  await deletePersonalLedger(pg, scope(mine), name);
  expect(await householdSnapshot()).toEqual(before);
  expect((await pg.query("SELECT id FROM workspaces WHERE id=$1", [mine])).rows).toEqual([]);
  expect((await pg.query("SELECT id FROM accounts WHERE workspace_id=$1", [mine])).rows).toEqual([]);
  expect((await pg.query("SELECT id FROM transactions WHERE workspace_id=$1", [mine])).rows).toEqual([]);
  expect((await pg.query("SELECT id FROM receipt_images")).rows).toEqual([]);
  expect((await pg.query("SELECT id FROM transaction_comments")).rows).toEqual([]);
  expect((await pg.query("SELECT id FROM account_shares")).rows).toEqual([]);
  expect((await pg.query("SELECT workspace_id FROM sessions WHERE id='personal-session'")).rows).toEqual([{ workspace_id: null }]);
  expect((await pg.query("SELECT workspace_id FROM sessions WHERE id='shared-session'")).rows).toEqual([{ workspace_id: "home" }]);
  const fresh = await openPersonalLedger(pg, scope("home"));
  expect(fresh).not.toBe(mine);
  expect((await pg.query("SELECT id FROM accounts WHERE workspace_id=$1", [fresh])).rows).toEqual([]);
  auth.workspace = fresh;
  expect(await deletePrivateTracker({ workspace: fresh, confirmation: name })).toEqual({ ok: true });
});
