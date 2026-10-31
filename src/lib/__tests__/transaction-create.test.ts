import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { AppDb } from "../db";
import { createWithHistory, transactionCreateSchema } from "../transaction-create";
import { statementComparison } from "../reconciliation";

let client: PGlite;
let db: AppDb;
const actor = { id: "owner", name: "Test household" };
const payload = (extra = {}) => ({
  type: "expense", amount: "6.50", date: "2026-10-31", accountId: "bank",
  categoryId: "food", tagIds: ["tag"], note: "Coffee", requestId: "request-create-0001", ...extra,
});
const create = (extra = {}) => createWithHistory(db, "home", actor, payload(extra));
const count = async (table: string) => Number((await client.query<{ count: string }>(`SELECT count(*) FROM ${table}`)).rows[0].count);

beforeAll(async () => {
  client = new PGlite();
  const local = drizzle(client);
  await migrate(local, { migrationsFolder: "./drizzle" });
  db = local as unknown as AppDb;
  await client.exec(`
    INSERT INTO users(id,email,password_hash) VALUES ('owner','owner@example.test','x'),('member','member@example.test','x');
    INSERT INTO workspaces(id,name,owner_id) VALUES ('home','Home','owner'),('other','Other','member');
    INSERT INTO workspace_members(workspace_id,user_id,role) VALUES ('home','owner','owner'),('home','member','member'),('other','member','owner');
    INSERT INTO accounts(id,workspace_id,name,initial_balance) VALUES ('bank','home','Bank',100),('cash','home','Cash',50),('private','other','Private',99999);
    INSERT INTO categories(id,workspace_id,name,kind) VALUES ('food','home','Food','expense'),('salary','home','Salary','income'),('private-category','other','Private','expense');
    INSERT INTO tags(id,workspace_id,name) VALUES ('tag','home','Everyday'),('private-tag','other','Private');
    INSERT INTO transactions(id,workspace_id,type,amount,date,account_id,note) VALUES ('historical','home','expense',12.34,'2026-10-01','bank','Preserve');
    INSERT INTO transfers(id,workspace_id,from_account_id,to_account_id,amount,date) VALUES ('move','home','bank','cash',20,'2026-10-02');
  `);
}, 60000);
beforeEach(async () => {
  await client.exec(`DELETE FROM transaction_history;
    DELETE FROM transactions WHERE id <> 'historical';
    UPDATE accounts SET archived=false WHERE id='bank';
    UPDATE workspace_members SET role='owner' WHERE user_id='owner' AND workspace_id='home';`);
});
afterAll(async () => { await client?.close(); });

describe("atomic, retry-safe manual creation", () => {
  it("records the exact creation, tags, actor and unchanged historical balance", async () => {
    const result = await create();
    expect(result.replayed).toBe(false);
    expect(await count("transactions")).toBe(2);
    expect(await count("transaction_tags")).toBe(1);
    const history = (await client.query<{ before: object; after: Record<string, unknown>; actor_name: string }>("SELECT * FROM transaction_history")).rows[0];
    expect(history.before).toEqual({});
    expect(history.after).toMatchObject({ id: result.id, amount: "6.50", tag_ids: ["tag"], created_by: "owner" });
    expect(history.actor_name).toBe(actor.name);
    const entries = (await client.query<{ date: string; type: string; amount: string }>("SELECT date::text,type,amount::text FROM transactions WHERE account_id='bank'")).rows;
    expect(statementComparison(100, entries.map(row => ({ ...row, amount: Number(row.amount) })), [
      { date: "2026-10-02", amount: 20, fromAccountId: "bank", toAccountId: "cash" },
    ], "bank", "2026-10-31", 61.16).matched).toBe(true);
    expect((await client.query("SELECT amount::text,note FROM transactions WHERE id='historical'")).rows).toEqual([{ amount: "12.34", note: "Preserve" }]);
  });

  it("replays a lost response without reinserting, including equivalent amount/tag inputs", async () => {
    const first = await create();
    expect(await create({ amount: 6.5, tagIds: ["tag", "tag"], note: " Coffee " })).toEqual({ ...first, replayed: true });
    expect(await count("transactions")).toBe(2);
    expect(await count("transaction_history")).toBe(1);
    expect(await count("transaction_tags")).toBe(1);
  });

  it("coalesces competing requests using a database uniqueness constraint", async () => {
    const results = await Promise.all([create(), create(), create()]);
    expect(new Set(results.map(result => result.id)).size).toBe(1);
    expect(results.filter(result => !result.replayed)).toHaveLength(1);
    expect(await count("transaction_history")).toBe(1);
  });

  it("rejects changed payloads for an already committed request", async () => {
    await create();
    await expect(create({ amount: 100 })).rejects.toThrow("already saved with different details");
    expect(await count("transactions")).toBe(2);
  });

  it("does not deduplicate genuine identical purchases with distinct request identities", async () => {
    const first = await create();
    const next = await create({ requestId: "request-create-0002" });
    expect(next.id).not.toBe(first.id);
    expect(await count("transactions")).toBe(3);
  });

  it("keeps old clients working atomically but makes no retry promise without a key", async () => {
    await create({ requestId: undefined });
    await create({ requestId: undefined });
    expect(await count("transaction_history")).toBe(2);
  });

  it("never resurrects a deleted transaction on retry", async () => {
    const first = await create();
    await client.query("DELETE FROM transactions WHERE id=$1", [first.id]);
    await expect(create()).rejects.toThrow("later deleted");
    expect(await count("transactions")).toBe(1);
    expect(await count("transaction_history")).toBe(1);
  });

  it("replays without reverting a subsequent edit or requiring an active account", async () => {
    const first = await create();
    await client.query("UPDATE transactions SET amount=9 WHERE id=$1", [first.id]);
    await client.exec("UPDATE accounts SET archived=true WHERE id='bank'");
    expect((await create()).replayed).toBe(true);
    expect((await client.query("SELECT amount::text FROM transactions WHERE id=$1", [first.id])).rows[0]).toEqual({ amount: "9.00" });
  });

  it("scopes identities to their actor and workspace and rechecks current access", async () => {
    const first = await create();
    const second = await createWithHistory(db, "home", { id: "member", name: "Partner" }, payload());
    expect(second.id).not.toBe(first.id);
    await expect(createWithHistory(db, "other", actor, payload({ accountId: "private", categoryId: null, tagIds: [] }))).rejects.toThrow("Check your access");
    await client.exec("UPDATE workspace_members SET role='viewer' WHERE user_id='owner' AND workspace_id='home'");
    await expect(create()).rejects.toThrow("Check your access");
    expect(await count("transaction_history")).toBe(2);
  });

  it.each([
    { accountId: "private" }, { categoryId: "private-category" },
    { categoryId: "salary" }, { tagIds: ["private-tag"] }, { tagIds: ["missing"] },
  ])("rejects foreign, missing, or wrong-kind references atomically: %j", async (extra) => {
    await expect(create(extra)).rejects.toThrow("Check your access");
    expect(await count("transactions")).toBe(1);
    expect(await count("transaction_history")).toBe(0);
  });

  it("rejects new postings to archived accounts", async () => {
    await client.exec("UPDATE accounts SET archived=true WHERE id='bank'");
    await expect(create()).rejects.toThrow("active account");
    expect(await count("transaction_history")).toBe(0);
  });

  it.each(["transaction_history", "transactions", "transaction_tags"])("rolls back all writes if %s fails, then allows retry", async (table) => {
    await client.exec(`CREATE FUNCTION fail_create_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected failure'; END; $$;
      CREATE TRIGGER fail_create BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION fail_create_test();`);
    try {
      await expect(create()).rejects.toThrow();
      expect(await count("transactions")).toBe(1);
      expect(await count("transaction_history")).toBe(0);
      expect(await count("transaction_tags")).toBe(0);
    } finally {
      await client.exec(`DROP TRIGGER fail_create ON ${table}; DROP FUNCTION fail_create_test();`);
    }
    expect((await create()).replayed).toBe(false);
  });
});

describe("creation input boundaries", () => {
  it.each([0, -1, Infinity, NaN, "1.001", "1e3", "1000000000000", "", "6.50oops"])("rejects invalid or silently rounded amount %s", (amount) => {
    expect(transactionCreateSchema.safeParse(payload({ amount })).success).toBe(false);
  });
  it.each(["2026-02-29", "2026-04-31", "0000-01-01", "2026-13-01"])("rejects invalid date %s", (date) => {
    expect(transactionCreateSchema.safeParse(payload({ date })).success).toBe(false);
  });
  it("normalizes supported values without changing financial precision", () => {
    expect(transactionCreateSchema.parse(payload({ amount: "000006.5", date: "2024-02-29" })).amount).toBe("6.50");
    expect(transactionCreateSchema.parse(payload({ amount: "999999999999.99" })).amount).toBe("999999999999.99");
  });
});
