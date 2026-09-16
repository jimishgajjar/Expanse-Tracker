import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema";
import type { AppDb } from "../db";
import { postRecurringOccurrences } from "../recurring-posting";
import { safeReturnPath } from "../safe-redirect";
import { mergeActivity } from "../activity";
import type { TransactionDTO, TransferDTO } from "../queries";

const state = vi.hoisted(() => ({ db: null as unknown as AppDb }));
vi.mock("../db", () => ({ getDb: async () => state.db }));
import { consumePasswordReset, updatePasswordAndSessions } from "../password-update";

let client: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;
let userId: string;
let workspaceId: string;
let accountId: string;
beforeAll(async () => {
  client = new PGlite();
  db = drizzle(client, { schema });
  state.db = db as unknown as AppDb;
  await migrate(db, { migrationsFolder: "./drizzle" });
  const [user] = await db.insert(schema.users).values({ email: "safety@example.test", passwordHash: "old" }).returning();
  userId = user.id;
  const [workspace] = await db.insert(schema.workspaces).values({ name: "Isolated test", ownerId: userId }).returning();
  workspaceId = workspace.id;
  const [account] = await db.insert(schema.accounts).values({ workspaceId, name: "Test bank" }).returning();
  accountId = account.id;
  await db.insert(schema.transactions).values({ workspaceId, accountId, amount: "123.45", type: "income", date: "2025-01-01", note: "Historical entry" });
});
afterAll(async () => { await client?.close(); });

async function rule() {
  const [result] = await db.insert(schema.recurring).values({ workspaceId, accountId, type: "expense", amount: "10", frequency: "monthly", nextDate: "2026-01-01" }).returning();
  return result;
}
const entry = () => ({ workspaceId, accountId, type: "expense" as const, amount: "10", date: "2026-01-01", note: "Scheduled", categoryId: null });

describe("existing-schema financial safety", () => {
  it("claims a due rule only once across racing workers and retries, preserving history", async () => {
    const r = await rule();
    const results = await Promise.all([
      postRecurringOccurrences(state.db, r, "2026-02-01", 1, [entry()]),
      postRecurringOccurrences(state.db, r, "2026-02-01", 1, [entry()]),
    ]);
    expect(results.sort()).toEqual([false, true]);
    expect(await postRecurringOccurrences(state.db, r, "2026-02-01", 1, [entry()])).toBe(false);
    const rows = await db.select().from(schema.transactions);
    expect(rows.filter(t => t.note === "Scheduled")).toHaveLength(1);
    expect(rows.find(t => t.note === "Historical entry")?.amount).toBe("123.45");
  });

  it("rolls back the schedule if insertion fails, then permits a valid retry", async () => {
    const r = await rule();
    await expect(postRecurringOccurrences(state.db, r, "2026-02-01", 1, [{ ...entry(), accountId: "missing" }])).rejects.toThrow();
    const [unchanged] = await db.select().from(schema.recurring).where(eq(schema.recurring.id, r.id));
    expect(unchanged.nextDate).toBe("2026-01-01");
    expect(unchanged.occurrenceCount).toBe(0);
    expect(await postRecurringOccurrences(state.db, r, "2026-02-01", 1, [entry()])).toBe(true);
  });

  it("advances reminder-only bills without inventing a transaction", async () => {
    const r = await rule();
    const before = (await db.select().from(schema.transactions)).length;
    expect(await postRecurringOccurrences(state.db, r, "2026-02-01", 1, [])).toBe(true);
    expect(await db.select().from(schema.transactions)).toHaveLength(before);
  });
});

describe("credential recovery", () => {
  it("keeps the current session on a password change and revokes others", async () => {
    await db.insert(schema.sessions).values(["current", "other"].map(id => ({ id, userId, expiresAt: new Date(Date.now() + 60000) })));
    await updatePasswordAndSessions(userId, "changed", "current");
    expect((await db.select().from(schema.sessions)).map(s => s.id)).toEqual(["current"]);
  });
  it("consumes a reset once and revokes existing sessions and reset links", async () => {
    await db.insert(schema.passwordResets).values(["reset", "second"].map(id => ({ id, userId, expiresAt: new Date(Date.now() + 60000) })));
    expect(await consumePasswordReset("reset", "recovered")).toBe(userId);
    expect(await consumePasswordReset("reset", "replay")).toBeNull();
    expect(await db.select().from(schema.sessions)).toHaveLength(0);
    expect(await db.select().from(schema.passwordResets)).toHaveLength(0);
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
    expect(user.passwordHash).toBe("recovered");
  });
});

it("allows local return paths and rejects external or backslash redirects", () => {
  expect(safeReturnPath("/?tab=transactions")).toBe("/?tab=transactions");
  for (const path of ["https://example.com", "//example.com", "/\\example.com", "javascript:alert(1)", null]) expect(safeReturnPath(path)).toBe("/");
});

it("includes transfers in chronological activity without changing transaction amounts", () => {
  const transaction = { id: "tx", date: "2026-01-01", type: "income", amount: 100 } as TransactionDTO;
  const transfer = { id: "transfer", date: "2026-01-02", amount: 50 } as TransferDTO;
  const activity = mergeActivity([transaction], [transfer]);
  expect(activity.map(a => a.kind)).toEqual(["transfer", "transaction"]);
  expect(transaction.amount).toBe(100);
});
