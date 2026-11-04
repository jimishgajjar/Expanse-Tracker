import { AsyncLocalStorage } from "node:async_hooks";
import { beforeAll, afterAll, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../db/schema";
import { proxy } from "@/proxy";
import { getSession, createApiSession } from "../session";
import { createAccount, createTransaction } from "../actions";
import { enterPersonalTracker } from "../personal-actions";
import { removeMember } from "../sharing";
import { GET as me } from "@/app/api/mobile/me/route";
import { GET as bootstrap } from "@/app/api/mobile/bootstrap/route";
import { POST as addAccount } from "@/app/api/mobile/accounts/route";
import { REQUIRED_HEADER, VIEW_HEADER } from "../tracker-view";

const context = new AsyncLocalStorage<NextRequest>();
const pg = new PGlite();
const database = drizzle(pg, { schema });
vi.mock("../db", () => ({ getDb: async () => database }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("../personal-preview", () => ({ personalPreviewEnabled: () => true }));
vi.mock("next/headers", () => ({
  headers: async () => context.getStore()!.headers,
  cookies: async () => context.getStore()!.cookies,
}));

// Use real session rows and the headers Next forwards from the real proxy.
function client(token: string, native = false) {
  return async <T>(path: string, method: string, view: string | null, handler: () => Promise<T>) => {
    const headers = new Headers(native ? { Authorization: "Bearer " + token } : { Cookie: "mt_session=" + token });
    if (view) headers.set(VIEW_HEADER, view);
    const req = new NextRequest("http://localhost" + path, { method, headers });
    const response = proxy(req);
    if (response.status !== 200) throw Error("HTTP " + response.status);
    const required = response.headers.get("x-middleware-request-" + REQUIRED_HEADER);
    if (required) req.headers.set(REQUIRED_HEADER, required);
    return context.run(req, handler);
  };
}
beforeAll(async () => {
  await migrate(database, { migrationsFolder: "./drizzle" });
  await pg.exec(`
    INSERT INTO users(id,email,password_hash) VALUES ('owner','owner@example.test','x'),('member','member@example.test','x');
    INSERT INTO workspaces(id,name,owner_id) VALUES ('home','Test household','owner');
    INSERT INTO workspace_members(workspace_id,user_id,role) VALUES ('home','owner','owner'),('home','member','member');
    INSERT INTO accounts(id,workspace_id,name) VALUES ('shared-bank','home','Shared bank');`);
}, 60000);
afterAll(() => pg.close());

it("rejects stale web forms and clears the mobile view after a second signed-in member revokes access", async () => {
  const web = client(await createApiSession("member", "home"));
  const owner = client(await createApiSession("owner", "home"));
  const stamp = async () => (await getSession())!.viewKey;
  const shared = await web("/", "GET", null, stamp);
  const admin = await owner("/", "GET", null, stamp);
  const form = { type: "expense", amount: 4, date: "2026-11-01", accountId: "shared-bank" };
  expect(await web("/", "POST", shared, () => createTransaction(form))).toMatchObject({ ok: true });
  expect(await web("/", "POST", shared, () => enterPersonalTracker("home"))).toMatchObject({ ok: true });
  const privateId = await web("/", "GET", null, async () => (await getSession())!.workspaceId!);
  expect(privateId).toMatch(/^personal:/);
  const phone = client(await createApiSession("member", privateId), true);
  const privatePhone = await phone("/api/mobile/me", "GET", null, stamp);
  expect(await web("/", "POST", shared, () => createTransaction(form))).toMatchObject({ ok: false });
  // No account reference to catch an accidental retargeting of this second write.
  for (const stale of [null, shared, privatePhone]) {
    expect(await web("/", "POST", stale, () => createAccount({ name: "Wrong ledger" }))).toMatchObject({ ok: false });
  }
  await expect(phone("/api/mobile/accounts", "POST", null, async () => true)).rejects.toThrow("428");
  const write = () => addAccount(new Request("http://localhost", { method: "POST", body: JSON.stringify({ name: "Private bank" }) }));
  expect((await phone("/api/mobile/accounts", "POST", privatePhone, write)).status).toBe(200);
  expect(await owner("/", "POST", admin, () => removeMember("member"))).toMatchObject({ ok: true });
  expect((await phone("/api/mobile/accounts", "POST", privatePhone, write)).status).toBe(401);
  expect((await phone("/api/mobile/bootstrap", "GET", privatePhone, () => bootstrap(new Request("http://localhost/")))).status).toBe(401);
  const restored = await (await phone("/api/mobile/me", "GET", null, () => me(new Request("http://localhost/api/mobile/me")))).json();
  expect(restored.activeWorkspaceId).toBeNull();
  expect(restored.workspaces).toEqual([]);
  expect(restored.viewKey).not.toBe(privatePhone);
  expect((await pg.query("SELECT name FROM accounts ORDER BY name")).rows).toEqual([{name:"Private bank"},{name:"Shared bank"}]);
  expect((await pg.query("SELECT workspace_id FROM transactions")).rows).toEqual([{workspace_id:"home"}]);
});
