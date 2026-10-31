import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { AppDb } from "../db";

const state = vi.hoisted(() => ({ db: null as unknown as AppDb, signedIn: true, role: "owner", revalidate: vi.fn() }));
vi.mock("../db", () => ({ getDb: async () => state.db }));
vi.mock("../session", () => ({
  getSession: async () => state.signedIn ? { user: { id: "user", name: "Owner", email: "owner@example.test" }, workspaceId: "home" } : null,
  getCurrentUser: async () => state.signedIn ? { id: "user", name: "Owner", email: "owner@example.test" } : null,
}));
vi.mock("../workspace", () => ({
  getActiveWorkspaceId: async () => state.signedIn ? "home" : null,
  getActiveRole: async () => state.role,
}));
vi.mock("next/cache", () => ({ revalidatePath: state.revalidate }));
import { POST } from "@/app/api/mobile/transactions/route";

let client: PGlite;
beforeAll(async () => {
  client = new PGlite();
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: "./drizzle" });
  state.db = db as unknown as AppDb;
  await client.exec(`INSERT INTO users(id,email,password_hash) VALUES ('user','owner@example.test','x');
    INSERT INTO workspaces(id,name,owner_id) VALUES ('home','Home','user');
    INSERT INTO workspace_members(workspace_id,user_id,role) VALUES ('home','user','owner');
    INSERT INTO accounts(id,workspace_id,name) VALUES ('bank','home','Bank');`);
}, 60000);
beforeEach(async () => {
  state.signedIn = true;
  state.role = "owner";
  state.revalidate.mockReset();
  await client.exec("DELETE FROM transactions; DELETE FROM transaction_history");
});
afterAll(async () => { await client?.close(); });
const request = (patch = {}) => new Request("http://localhost/api/mobile/transactions", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ type: "expense", amount: 12.34, date: "2026-10-31", accountId: "bank", requestId: "mobile-request-0001", ...patch }),
});
const count = async () => Number((await client.query<{ count: string }>("SELECT count(*) FROM transactions")).rows[0].count);

it("uses the authenticated workspace and returns a stable non-cacheable retry receipt", async () => {
  const first = await POST(request({ workspaceId: "attacker-workspace", createdBy: "someone-else" }));
  expect(first.status).toBe(200);
  expect(first.headers.get("cache-control")).toBe("private, no-store");
  const body = await first.json();
  const replay = await (await POST(request())).json();
  expect(replay.data).toEqual({ id: body.data.id, replayed: true });
  expect(await count()).toBe(1);
  expect((await client.query("SELECT workspace_id,created_by FROM transactions")).rows[0]).toEqual({ workspace_id: "home", created_by: "user" });
});

it("can retry after a response failure following a committed write", async () => {
  state.revalidate.mockImplementationOnce(() => { throw new Error("private server detail"); });
  const first = await POST(request());
  expect(first.status).toBe(400);
  expect(await first.text()).not.toContain("private server detail");
  expect(await count()).toBe(1);
  const retry = await POST(request());
  expect(retry.status).toBe(200);
  expect((await retry.json()).data.replayed).toBe(true);
  expect(await count()).toBe(1);
});

it("denies anonymous and viewer requests", async () => {
  state.signedIn = false;
  expect((await POST(request())).status).toBe(401);
  state.signedIn = true;
  state.role = "viewer";
  expect((await POST(request())).status).toBe(400);
  expect(await count()).toBe(0);
});

it("rejects invalid bodies and conflicting retries without extra ledger writes", async () => {
  expect((await POST(new Request("http://localhost/api/mobile/transactions", { method: "POST", body: "bad-json" }))).status).toBe(400);
  expect((await POST(request({ amount: 1.001 }))).status).toBe(400);
  expect(await count()).toBe(0);
  await POST(request());
  expect((await POST(request({ amount: 99 }))).status).toBe(400);
  expect(await count()).toBe(1);
});
