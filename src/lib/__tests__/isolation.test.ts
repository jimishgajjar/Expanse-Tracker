import { beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";

// Shared mutable state the mocks read from (vi.hoisted runs before imports).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const h = vi.hoisted(() => ({ db: null as any, activeWs: null as string | null }));

vi.mock("@/lib/db", () => ({ getDb: async () => h.db }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/workspace", () => ({
  getActiveWorkspaceId: async () => h.activeWs,
  getUserWorkspaces: async () => [],
  getActiveWorkspace: async () => null,
}));

// Imported under the mocks above.
import { getAccountsWithBalances, getTransactionsInRange } from "@/lib/queries";
import { deleteTransaction, updateTransaction } from "@/lib/actions";

const ids = { wsA: "", wsB: "", txA: "", txB: "" };

beforeAll(async () => {
  const client = new PGlite(); // in-memory
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  h.db = db;

  const [uA] = await db.insert(schema.users).values({ email: "a@x.com", passwordHash: "x" }).returning();
  const [uB] = await db.insert(schema.users).values({ email: "b@x.com", passwordHash: "x" }).returning();
  const [wA] = await db.insert(schema.workspaces).values({ name: "A", ownerId: uA.id }).returning();
  const [wB] = await db.insert(schema.workspaces).values({ name: "B", ownerId: uB.id }).returning();
  ids.wsA = wA.id; ids.wsB = wB.id;
  await db.insert(schema.workspaceMembers).values([
    { workspaceId: wA.id, userId: uA.id, role: "owner" },
    { workspaceId: wB.id, userId: uB.id, role: "owner" },
  ]);

  const [aA] = await db.insert(schema.accounts).values({ workspaceId: wA.id, name: "A-cash" }).returning();
  const [aB] = await db.insert(schema.accounts).values({ workspaceId: wB.id, name: "B-cash" }).returning();
  const [cA] = await db.insert(schema.categories).values({ workspaceId: wA.id, name: "A-cat", kind: "expense" }).returning();
  const [cB] = await db.insert(schema.categories).values({ workspaceId: wB.id, name: "B-cat", kind: "expense" }).returning();
  const [tA] = await db.insert(schema.transactions).values({ workspaceId: wA.id, type: "expense", amount: "100", date: "2026-06-01", accountId: aA.id, categoryId: cA.id }).returning();
  const [tB] = await db.insert(schema.transactions).values({ workspaceId: wB.id, type: "expense", amount: "999", date: "2026-06-01", accountId: aB.id, categoryId: cB.id }).returning();
  ids.txA = tA.id; ids.txB = tB.id;
});

const txAmount = async (id: string) => {
  const [row] = await h.db.select().from(schema.transactions).where(eq(schema.transactions.id, id));
  return row?.amount as string | undefined;
};

describe("workspace isolation", () => {
  it("queries return only the active workspace's rows", async () => {
    h.activeWs = ids.wsA;
    const accs = await getAccountsWithBalances();
    expect(accs.map((a) => a.name)).toEqual(["A-cash"]);

    const txns = await getTransactionsInRange("2026-06-01", "2026-07-01");
    expect(txns.map((t) => t.id)).toEqual([ids.txA]);
    expect(txns.find((t) => t.id === ids.txB)).toBeUndefined();
  });

  it("switching the active workspace flips which rows are visible", async () => {
    h.activeWs = ids.wsB;
    const accs = await getAccountsWithBalances();
    expect(accs.map((a) => a.name)).toEqual(["B-cash"]);
    const txns = await getTransactionsInRange("2026-06-01", "2026-07-01");
    expect(txns.map((t) => t.id)).toEqual([ids.txB]);
  });

  it("an update cannot touch another workspace's row (IDOR guard)", async () => {
    h.activeWs = ids.wsA; // acting inside A
    const before = await txAmount(ids.txB);
    const res = await updateTransaction(ids.txB, { amount: 1 }); // try to edit B's transaction
    expect(res.ok).toBe(true); // the action runs, but the WHERE clause matches 0 rows
    expect(await txAmount(ids.txB)).toBe(before); // B's row is unchanged
  });

  it("a delete cannot remove another workspace's row", async () => {
    h.activeWs = ids.wsA;
    await deleteTransaction(ids.txB);
    expect(await txAmount(ids.txB)).toBeDefined(); // B's transaction still exists
  });
});
