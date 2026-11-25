import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { AppDb } from "../db";

let client: PGlite, db: AppDb;
let role = "owner";
vi.mock("../db", () => ({ getDb: async () => db }));
vi.mock("../workspace", () => ({ getActiveWorkspaceId: async () => "w", getActiveRole: async () => role }));
vi.mock("../session", () => ({ getCurrentUser: async () => ({ id: "owner", name: "Owner", email: "o@demo.test" }) }));
import { budgetSuggestions } from "../budget-suggestions";
import { quickEntries } from "../quick-entries";
import { merchantKey } from "../import-category-suggest";

// Dates relative to today so the "last three full months" window is stable.
const monthsAgo = (n: number, day = 10) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  d.setDate(day);
  return d.toISOString().slice(0, 10);
};
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

beforeAll(async () => {
  client = new PGlite();
  const local = drizzle(client);
  await migrate(local, { migrationsFolder: "./drizzle" });
  db = local as unknown as AppDb;
}, 60000);
beforeEach(async () => {
  role = "owner";
  await client.exec(`TRUNCATE workspaces,users CASCADE;
    INSERT INTO users(id,email,password_hash) VALUES ('owner','o@demo.test','x');
    INSERT INTO workspaces(id,name,owner_id) VALUES ('w','Demo','owner'),('other','Other','owner');
    INSERT INTO workspace_members(workspace_id,user_id,role) VALUES ('w','owner','owner'),('other','owner','owner');
    INSERT INTO accounts(id,workspace_id,name) VALUES ('bank','w','Bank'),('foreign','other','Bank');
    INSERT INTO categories(id,workspace_id,name,kind) VALUES ('food','w','Groceries','expense'),('home','w','India transfer','expense'),('x','other','Food','expense');`);
});
afterAll(async () => { await client?.close(); });

it("suggests tidy limits from the last three full months only, for this tracker", async () => {
  await client.exec(`INSERT INTO transactions(id,workspace_id,account_id,category_id,type,date,amount,note) VALUES
    ('a','w','bank','food','expense','${monthsAgo(1)}',300,'Walmart'),
    ('b','w','bank','food','expense','${monthsAgo(2)}',280,'Walmart'),
    ('c','w','bank','food','expense','${monthsAgo(3)}',322,'Walmart'),
    ('d','w','bank','food','expense','${monthsAgo(0, 1)}',5000,'This month is excluded'),
    ('e','w','bank','food','expense','${monthsAgo(5)}',9000,'Too old'),
    ('f','w','bank','home','expense','${monthsAgo(1)}',1500,'Family'),
    ('g','other','foreign','x','expense','${monthsAgo(1)}',777,'Other tracker')`);
  const rows = await budgetSuggestions();
  expect(rows.map((r) => r.categoryId)).toEqual(["home", "food"]);
  const food = rows.find((r) => r.categoryId === "food")!;
  expect(food.average).toBeCloseTo(300.67, 1);
  expect(food.suggested).toBe(310);
  expect(food.peak).toBe(322);
  expect(rows.find((r) => r.categoryId === "home")!.suggested).toBe(500);
});

it("offers repeat entries used at least twice recently, newest amount first, editors only", async () => {
  await client.exec(`INSERT INTO transactions(id,workspace_id,account_id,category_id,type,date,amount,note,created_at) VALUES
    ('a','w','bank','food','expense','${daysAgo(20)}',80,'Walmart','2026-01-01'),
    ('b','w','bank','food','expense','${daysAgo(5)}',95.5,'walmart ','2026-01-02'),
    ('c','w','bank',NULL,'expense','${daysAgo(3)}',12,'One-off',now()),
    ('d','w','bank','food','expense','${daysAgo(400)}',10,'Old',now()),
    ('e','w','bank','food','expense','${daysAgo(401)}',10,'Old',now())`);
  const rows = await quickEntries();
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ type: "expense", note: "walmart ", accountId: "bank", categoryId: "food", amount: 95.5, uses: 2 });
  role = "viewer";
  expect(await quickEntries()).toEqual([]);
});

it("reduces bank descriptions to a stable merchant key", () => {
  expect(merchantKey("WALMART #1234 TORONTO ON")).toBe("walmart toronto");
  expect(merchantKey("Netflix.com")).toBe("netflix com");
  expect(merchantKey("  ")).toBe("");
});

it("flags a card-bill category only when it is a meaningful share of spending", async () => {
  const { cardBillShare } = await import("../card-bill");
  const cats = [{ id: "cc", name: "Credit Card Bill", kind: "expense" }, { id: "food", name: "Groceries", kind: "expense" }];
  const tx = (categoryId: string | null, amount: number, type = "expense") => ({ type, amount, categoryId });
  expect(cardBillShare(cats, [tx("cc", 2000), tx("food", 8000)])).toEqual({ share: 20, billTotal: 2000, name: "Credit Card Bill" });
  expect(cardBillShare(cats, [tx("cc", 500), tx("food", 9500)])).toBeNull();
  expect(cardBillShare(cats, [tx("food", 100), tx("cc", 900, "income")])).toBeNull();
  expect(cardBillShare([{ id: "x", name: "CC payment", kind: "expense" }], [tx("x", 1)])?.share).toBe(100);
  expect(cardBillShare([{ id: "x", name: "Discover", kind: "expense" }], [tx("x", 1)])).toBeNull();
});
