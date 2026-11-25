import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { AppDb } from "../db";
import { convertToTransfer, moveToOpeningBalance, transferCandidates } from "../convert-transfer";

let client: PGlite, db: AppDb;
const s = { workspace: "w", actor: "owner", name: "Owner" };
const balances = async () => Object.fromEntries((await client.query<{ id: string; b: string }>(`SELECT a.id, (a.initial_balance
  + coalesce((SELECT sum(CASE WHEN t.type='income' THEN t.amount ELSE -t.amount END) FROM transactions t WHERE t.account_id=a.id),0)
  + coalesce((SELECT sum(x.amount) FROM transfers x WHERE x.to_account_id=a.id),0)
  - coalesce((SELECT sum(x.amount) FROM transfers x WHERE x.from_account_id=a.id),0))::text AS b FROM accounts a ORDER BY a.id`)).rows.map((r) => [r.id, r.b]));
const count = async (sql: string) => (await client.query<{ n: number }>(sql)).rows[0].n;

beforeAll(async () => {
  client = new PGlite();
  const local = drizzle(client);
  await migrate(local, { migrationsFolder: "./drizzle" });
  db = local as unknown as AppDb;
}, 60000);
beforeEach(async () => {
  await client.exec(`TRUNCATE workspaces, users CASCADE;
    INSERT INTO users(id,email,password_hash) VALUES ('owner','o@demo.test','x'),('view','v@demo.test','x');
    INSERT INTO workspaces(id,name,owner_id) VALUES ('w','Demo','owner'),('other','Other','owner');
    INSERT INTO workspace_members(workspace_id,user_id,role) VALUES ('w','owner','owner'),('w','view','viewer'),('other','owner','owner');
    INSERT INTO accounts(id,workspace_id,name,initial_balance) VALUES ('j','w','Jimish',1000),('h','w','Hani',500),('x','other','Foreign',0);
    INSERT INTO transactions(id,workspace_id,account_id,type,date,amount,note) VALUES
      ('out','w','j','expense','2025-04-29',108.58,'Transfer to Hani Account'),
      ('in','w','h','income','2025-04-30',108.58,'CRA 2025'),
      ('far','w','h','income','2025-06-30',108.58,'Too far apart'),
      ('opening','w','j','income','2025-01-26',3477.95,'Initial Balance');`);
});
afterAll(async () => { await client?.close(); });

it("finds the matching opposite entry on another account within a week", async () => {
  const rows = await transferCandidates(db, s, "out");
  expect(rows.map((r) => r.id)).toEqual(["in"]);
});

it("converts a pair into one transfer and leaves every balance unchanged", async () => {
  const before = await balances();
  const r = await convertToTransfer(db, s, { id: "out", otherAccountId: "h", counterpartId: "in" });
  expect(r.ok).toBe(true);
  expect(await balances()).toEqual(before);
  expect(await count("SELECT count(*)::int n FROM transactions WHERE id IN ('out','in')")).toBe(0);
  const t = (await client.query<{ from_account_id: string; to_account_id: string; amount: string; date: string }>("SELECT from_account_id,to_account_id,amount::text,date::text FROM transfers")).rows;
  expect(t).toEqual([{ from_account_id: "j", to_account_id: "h", amount: "108.58", date: "2025-04-29" }]);
  expect(await count("SELECT count(*)::int n FROM transaction_history WHERE after ? 'converted_to_transfer'")).toBe(2);
});

it("converting a single income keeps its own account balance", async () => {
  const before = await balances();
  expect((await convertToTransfer(db, s, { id: "in", otherAccountId: "j", counterpartId: null })).ok).toBe(true);
  const after = await balances();
  expect(after.h).toBe(before.h);
  expect(Number(after.j)).toBeCloseTo(Number(before.j) - 108.58, 2);
});

it("folds an opening balance into the account without changing its balance", async () => {
  const before = await balances();
  expect((await moveToOpeningBalance(db, s, "opening")).ok).toBe(true);
  expect(await balances()).toEqual(before);
  expect((await client.query<{ b: string }>("SELECT initial_balance::text b FROM accounts WHERE id='j'")).rows[0].b).toBe("4477.95");
});

it.each([
  ["viewer", { ...s, actor: "view" }, { id: "out", otherAccountId: "h", counterpartId: "in" }],
  ["same account", s, { id: "out", otherAccountId: "j", counterpartId: null }],
  ["foreign account", s, { id: "out", otherAccountId: "x", counterpartId: null }],
  ["counterpart not opposite", s, { id: "in", otherAccountId: "h", counterpartId: "far" }],
  ["other workspace", { ...s, workspace: "other" }, { id: "out", otherAccountId: "h", counterpartId: null }],
])("refuses %s and changes nothing", async (_label, scope, input) => {
  const before = await balances();
  expect((await convertToTransfer(db, scope, input)).ok).toBe(false);
  expect(await balances()).toEqual(before);
  expect(await count("SELECT count(*)::int n FROM transfers")).toBe(0);
  expect(await count("SELECT count(*)::int n FROM transactions")).toBe(4);
});
