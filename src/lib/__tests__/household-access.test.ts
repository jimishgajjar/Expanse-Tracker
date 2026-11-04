import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { AppDb } from "../db";
import * as schema from "../db/schema";

const state = vi.hoisted(() => ({ db: null as unknown as AppDb, actor: "owner", tracker: "home" as string | null }));
vi.mock("../db", () => ({getDb: async () => state.db}));
vi.mock("../session", () => ({
  getSession: async () => state.actor ? { user: { id: state.actor }, workspaceId: state.tracker, sessionId: "test-session", expiresAt:new Date("2099-01-01") } : null,
  getCurrentUser: async () => state.actor ? {id: state.actor, name: state.actor, email: state.actor + "@example.test"} : null,
}));
vi.mock("next/cache", () => ({revalidatePath: () => {}}));

import { GET as history } from "@/app/api/transaction-history/[id]/route";
import { GET as members } from "@/app/api/mobile/members/route";
import { GET as mobileMe } from "@/app/api/mobile/me/route";
import { GET as bootstrap } from "@/app/api/mobile/bootstrap/route";
import { POST as switchMobile } from "@/app/api/mobile/workspace/switch/route";
import { GET as tools } from "@/app/api/workspace-section/route";
import { createAccount, deleteTransaction } from "../actions";
import { editWithHistory } from "../transaction-edit";
import { getActiveWorkspaceId, getUserWorkspaces } from "../workspace";

const client = new PGlite();
const read = (id: string) => history(new Request("http://localhost"), {params: Promise.resolve({id})});
beforeAll(async () => {
  const db = drizzle(client, {schema});
  await migrate(db, {migrationsFolder:"./drizzle"});
  state.db = db as unknown as AppDb;
  await client.exec(`INSERT INTO users(id,email,name,password_hash)
    SELECT who,who||'@example.test',upper(who),'x' FROM unnest(ARRAY['owner','editor','viewer','outsider','bad']) who;
    INSERT INTO workspaces(id,name,owner_id) VALUES('home','Household','owner'),('away','Other tracker','outsider');
    INSERT INTO workspace_members(workspace_id,user_id,role) VALUES
      ('home','owner','owner'),('home','editor','member'),('home','viewer','viewer'),('away','outsider','owner'),('away','editor','member'),('home','bad','bogus');
    INSERT INTO invitations(workspace_id,email) VALUES('home','pending@example.test'),('away','foreign@example.test');
    INSERT INTO sessions(id,user_id,workspace_id,expires_at) VALUES('test-session','editor','home',now()+interval '1 day');
    INSERT INTO transactions(id,workspace_id,type,amount,date,created_by) VALUES
      ('shared','home','expense',12,'2026-11-01','viewer'),('legacy','home','income',32,'2026-11-02',null),
      ('secret','away','expense',999,'2026-11-01','outsider');
    INSERT INTO transaction_history(id,workspace_id,transaction_id,actor_id,actor_name,"before","after") VALUES
      ('event','home','shared','editor','Editor','{"amount":10}','{"amount":12,"_creation":{"source":"statement_correction","reason":"Checked statement","requestHash":"internal-only"}}');`);
},60000);
beforeEach(() => { state.actor = "owner"; state.tracker = "home"; });
afterAll(async () => { await client.close(); });

it.each([["owner",true],["editor",true],["viewer",false]] as const)("separates authorship, tracker and current access for %s", async (actor,canEdit) => {
  state.actor = actor;
  const response = await read("shared");
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  const body = await response.json();
  expect(body.access).toEqual({recordedBy:"VIEWER",tracker:"Household",canEdit});
  expect(body.history).toMatchObject([{actorName:"Editor",created:true,correctionReason:"Checked statement",before:{amount:10},after:{amount:12}}]);
  expect(JSON.stringify(body)).not.toContain("internal-only");
  expect((await (await read("legacy")).json())).toEqual({access:{recordedBy:null,tracker:"Household",canEdit},history:[]});
  expect((await read("secret")).status).toBe(404);
});

it.each(["owner","editor","viewer"])("only a current tracker owner receives pending addresses on web and mobile (%s)", async actor => {
  state.actor = actor;
  const web = await tools(new Request("http://localhost/api/workspace-section?section=tools&workspace=home"));
  const mobile = await members();
  for (const response of [web,mobile]) {
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await response.json();
    expect(body.members.map((m: {id:string}) => m.id).sort()).toEqual(["editor","owner","viewer"]);
    expect(body.invites).toEqual(actor === "owner" ? ["pending@example.test"] : []);
  }
});

it("rejects direct IDs and writes without a known membership, including when the author is a viewer", async () => {
  for (const actor of ["viewer","outsider","bad",""]) {
    state.actor = actor;
    if (actor !== "viewer") expect((await read("shared")).status).toBe(actor ? 404 : 401);
    expect(await deleteTransaction("shared")).toMatchObject({ok:false});
    expect(await editWithHistory(state.db,"home","shared",{id:actor,name:actor},{amount:500})).toBe(false);
  }
  expect((await client.query("SELECT amount FROM transactions WHERE id='shared'")).rows).toEqual([{amount:"12.00"}]);
});

it("allows an editing member to change a shared entry without taking its authorship", async () => {
  state.actor = "editor";
  await client.exec("INSERT INTO transactions(id,workspace_id,type,amount,date,created_by) VALUES('editable','home','expense',3,'2026-11-01','owner')");
  expect(await editWithHistory(state.db,"home","editable",{id:"editor",name:"Editor"},{amount:4})).toBe(true);
  const body = await (await read("editable")).json();
  expect(body.access.recordedBy).toBe("OWNER");
  expect(body.history[0]).toMatchObject({actorName:"Editor",created:false});
  expect(await deleteTransaction("editable")).toMatchObject({ok:true});
  expect((await read("editable")).status).toBe(404);
});

it("rechecks access after downgrade/removal and does not post a stale form to the next tracker", async () => {
  state.actor = "editor";
  try {
    await client.exec("UPDATE workspace_members SET role='viewer' WHERE workspace_id='home' AND user_id='editor'");
    expect((await (await read("shared")).json()).access.canEdit).toBe(false);
    expect(await editWithHistory(state.db,"home","shared",{id:"editor",name:"Editor"},{amount:80})).toBe(false);
    await client.exec("DELETE FROM workspace_members WHERE workspace_id='home' AND user_id='editor'");
    expect(await getActiveWorkspaceId()).toBeNull();
    expect((await getUserWorkspaces()).map(w=>w.id)).toEqual(["away"]);
    const me = await (await mobileMe(new Request("http://localhost/api/mobile/me"))).json();
    expect(me.activeWorkspaceId).toBeNull();
    const home = await (await bootstrap(new Request("http://localhost/api/mobile/bootstrap"))).json();
    expect(home).toMatchObject({activeWorkspaceId:null,accounts:[],transactions:[],transfers:[]});
    expect((await read("shared")).status).toBe(404);
    expect(await createAccount({name:"Stale form"})).toMatchObject({ok:false});
    expect((await client.query("SELECT id FROM accounts WHERE name='Stale form'")).rows).toEqual([]);
    state.tracker = null; // A deleted workspace clears the session's foreign key.
    expect(await getActiveWorkspaceId()).toBeNull();
    state.tracker = "away";
    expect((await read("secret")).status).toBe(200);
    expect((await read("shared")).status).toBe(404);
  } finally {
    await client.exec("INSERT INTO workspace_members(workspace_id,user_id,role) VALUES('home','editor','member') ON CONFLICT (workspace_id,user_id) DO UPDATE SET role='member'");
  }
});

it("only switches the authenticated mobile session to a current tracker", async () => {
  state.actor = "editor";
  const pick = (workspaceId: string, token: string) => switchMobile(new Request("http://localhost/api/mobile/workspace/switch", {
    method:"POST",headers:{authorization:"Bearer " + token,"content-type":"application/json"},body:JSON.stringify({workspaceId}),
  }));
  expect((await pick("away","unrelated-token")).status).toBe(401);
  expect((await pick("not-a-member","test-session")).status).toBe(403);
  expect((await client.query("SELECT workspace_id FROM sessions WHERE id='test-session'")).rows).toEqual([{workspace_id:"home"}]);
  expect((await pick("away","test-session")).status).toBe(200);
  expect((await client.query("SELECT workspace_id FROM sessions WHERE id='test-session'")).rows).toEqual([{workspace_id:"away"}]);
});
