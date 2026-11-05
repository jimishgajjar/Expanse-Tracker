import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { randomUUID } from "node:crypto";
import { chooseWeeklyReview, finishWeeklyReview, loadWeeklyReview } from "../weekly-review-store";
import { readWeeklyReview, saveWeeklyReviewChoice } from "../weekly-review-actions";
import type { WeeklyReviewData } from "../weekly-review-model";
import { confirmAccountShare, previewAccountShare, stopAccountShare } from "../account-share-store";

const app = vi.hoisted(() => ({ workspace: "home", actor: "a" }));
vi.mock("../session", () => ({ getSession: async () => ({ workspaceId: app.workspace, user: { id: app.actor } }) }));
vi.mock("../household-db", () => ({ getHouseholdDb: async () => db }));
const db = new PGlite();
const owner = { workspace: "home", actor: "a" }, partner = { ...owner, actor: "b" };
const now = new Date("2026-11-05T15:00:00Z");
const read = (scope = owner, at = now) => loadWeeklyReview(db, scope, at) as Promise<WeeklyReviewData>;
const decide = (data: WeeklyReviewData, key: string, choice: "reviewed" | "deferred" | "pending" = "reviewed") => ({
  version: data.version, key, revision: data.items.find(item => item.key === key)!.revision, choice,
});
const finish = (data: WeeklyReviewData) => ({ id: randomUUID(), version: data.version, digest: data.digest });
const ledger = async () => (await db.query(`SELECT
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM transactions t) AS transactions,
  (SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM accounts a) AS accounts,
  (SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM splits s) AS splits,
  (SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM recurring r) AS recurring,
  (SELECT jsonb_agg(to_jsonb(g) ORDER BY id) FROM goals g) AS goals`)).rows;

beforeAll(() => migrate(drizzle(db), { migrationsFolder: "./drizzle" }), 60000);
beforeEach(async () => {
  app.workspace = "home"; app.actor = "a";
  await db.exec(`TRUNCATE users,workspaces CASCADE;
    INSERT INTO users(id,email,name,password_hash) VALUES ('a','a@example.invalid','Ari','x'),('b','b@example.invalid','Bea','x'),('v','v@example.invalid','Viewer','x'),('x','x@example.invalid','Other','x');
    INSERT INTO workspaces(id,name,owner_id) VALUES ('home','Household','a'),('personal:b','PRIVATE','b'),('away','Other household','x');
    INSERT INTO workspace_members(workspace_id,user_id,role) VALUES ('home','a','owner'),('home','b','member'),('home','v','viewer'),('personal:b','b','owner'),('away','x','owner');
    INSERT INTO household_setup(workspace_id,timezone) VALUES ('home','America/Toronto');
    INSERT INTO app_settings(workspace_id,currency_code) VALUES ('home','CAD');
    INSERT INTO accounts(id,name,workspace_id,type,initial_balance) VALUES ('bank','Joint','home','bank',100),('secret','PRIVATE','personal:b','bank',999);
    INSERT INTO transactions(id,workspace_id,account_id,type,amount,date,note) VALUES ('entry','home','bank','expense',7.5,'2026-11-01','Market');
    INSERT INTO recurring(id,workspace_id,account_id,type,amount,note,frequency,next_date,auto_post) VALUES
      ('bill','home','bank','expense',20,'Utility','monthly','2026-11-06',false),
      ('far','home','bank','expense',10,'Future bill','monthly','2026-12-06',false),
      ('secret-bill','personal:b','secret','expense',999,'PRIVATE BILL','monthly','2026-11-06',false);
    INSERT INTO goals(id,workspace_id,name,target_amount,saved_amount) VALUES ('goal','home','Rainy day',100,10),('secret-goal','personal:b','PRIVATE GOAL',999,777);
    INSERT INTO splits(id,workspace_id,creditor_id,debtor_id,amount,note) VALUES ('iou','home','a','b',12,'Lunch'),('secret-iou','personal:b','b','a',99,'PRIVATE IOU');`);
});
afterAll(() => db.close());

it("resumes independent choices, saves a retry-safe receipt and preserves every financial row", async () => {
  const before = await ledger(), initial = await read();
  expect(initial.items.filter(i => i.status === "pending").map(i => i.kind)).toEqual(["bill", "reimbursement", "goal"]);
  expect(JSON.stringify(initial)).not.toMatch(/PRIVATE|secret/);
  expect(initial.items.map(i => i.amount)).toEqual(["20.00", "12.00", "100.00"]);
  const choice = decide(initial, "bill:bill");
  const reviewed = await chooseWeeklyReview(db, owner, choice, now);
  expect((await chooseWeeklyReview(db, owner, choice, now)).version).toBe(reviewed.version);
  const deferred = await chooseWeeklyReview(db, owner, decide(reviewed, "goal:goal", "deferred"), now);
  expect((await read()).items.find(i => i.key === "goal:goal")).toMatchObject({ status: "deferred", until: "2026-11-12" });
  const request = finish(deferred);
  const results = await Promise.all([finishWeeklyReview(db, owner, request, now), finishWeeklyReview(db, owner, request, now)]);
  expect(results[0].receipts).toHaveLength(1);
  expect(results[1].receipts).toHaveLength(1);
  expect(results[0].receipts[0].items.map(i => i.choice)).toEqual(["reviewed", "pending", "deferred"]);
  expect((await read(partner)).items.every(i => i.status === "pending")).toBe(true);
  expect((await read(partner)).receipts).toHaveLength(0);
  expect(await ledger()).toEqual(before);
});

it("reopens corrected and rescheduled bills, rejects stale choices and detects a change during finish", async () => {
  const initial = await read();
  const marked = await chooseWeeklyReview(db, owner, decide(initial, "bill:bill"), now);
  const finishRequest = finish(marked);
  await db.query("UPDATE recurring SET amount=27 WHERE id='bill'");
  await expect(finishWeeklyReview(db, owner, finishRequest, now)).rejects.toThrow(/changed during/);
  await expect(chooseWeeklyReview(db, owner, decide(marked, "bill:bill", "deferred"), now)).rejects.toThrow(/item changed/);
  const current = await read();
  expect(current.items.find(i => i.key === "bill:bill")).toMatchObject({ amount: "27.00", changed: true, status: "pending" });
  const corrected = await chooseWeeklyReview(db, owner, decide(current, "bill:bill"), now);
  const done = await finishWeeklyReview(db, owner, finish(corrected), now);
  expect(done.receipts[0].items.find(i => i.key === "bill:bill")?.changed).toBe(false);
  await db.query("UPDATE recurring SET next_date='2026-11-07' WHERE id='bill'");
  const rescheduled = await read();
  expect(rescheduled.items.find(i => i.key === "bill:bill")).toMatchObject({ changed: true, status: "pending" });
  expect(rescheduled.receipts[0].items.find(i => i.key === "bill:bill")?.changed).toBe(true);
  expect(rescheduled.items.find(i => i.key === "bill:bill")?.currency).toBe("CAD");
  await db.exec(`INSERT INTO finance_books(workspace_id,currency) VALUES('home','CAD');
    INSERT INTO finance_accounts(workspace_id,account_id,role,reviewed_balance,adjustment,interpretation,reviewer)
      VALUES('home','bank','cash',92.5,0,'signed','a');
    INSERT INTO account_denominations(workspace_id,account_id,currency) VALUES('home','bank','USD');`);
  const foreign = await read();
  expect(foreign.items.find(i => i.key === "bill:bill")).toMatchObject({ amount: "27.00", currency: "USD", changed: true });
  expect(foreign.items.find(i => i.key === "goal:goal")?.currency).toBe("CAD");
});

it("returns deferred goals on their household date, allows undo and rejects another tab's stale write", async () => {
  const initial = await read();
  const deferred = await chooseWeeklyReview(db, owner, decide(initial, "goal:goal", "deferred"), now);
  expect((await read(owner, new Date("2026-11-12T04:59:00Z"))).items.find(i => i.key === "goal:goal")?.status).toBe("deferred");
  expect((await read(owner, new Date("2026-11-12T05:00:00Z"))).items.find(i => i.key === "goal:goal")?.status).toBe("pending");
  await expect(chooseWeeklyReview(db, owner, decide(initial, "bill:bill"), now)).rejects.toThrow(/another tab/);
  const undone = await chooseWeeklyReview(db, owner, decide(deferred, "goal:goal", "pending"), now);
  expect(undone.items.find(i => i.key === "goal:goal")?.status).toBe("pending");
  await chooseWeeklyReview(db, owner, decide(undone, "bill:bill", "deferred"), now);
  // A calendar day passing must not cancel a seven-day deferral. Actual source edits still do.
  expect((await read(owner, new Date("2026-11-07T15:00:00Z"))).items.find(i => i.key === "bill:bill")?.status).toBe("deferred");
});

it("supports both partners reviewing concurrently and prevents viewers, strangers and stale tracker actions", async () => {
  const [a,b] = await Promise.all([read(),read(partner)]);
  await Promise.all([chooseWeeklyReview(db,owner,decide(a,"bill:bill"),now),chooseWeeklyReview(db,partner,decide(b,"goal:goal","deferred"),now)]);
  expect((await read()).items.find(i=>i.key==="goal:goal")?.status).toBe("pending");
  expect((await read(partner)).items.find(i=>i.key==="bill:bill")?.status).toBe("pending");
  expect((await read({...owner,actor:"v"})).canEdit).toBe(false);
  await expect(chooseWeeklyReview(db,{...owner,actor:"v"},decide(a,"bill:bill"),now)).rejects.toThrow(/access/);
  await expect(read({...owner,actor:"x"})).rejects.toThrow(/access/);
  await expect(read({workspace:"personal:b",actor:"b"})).rejects.toThrow(/shared household/);
  app.workspace="away";
  expect((await readWeeklyReview("home")).ok).toBe(false);
  expect((await saveWeeklyReviewChoice("home",decide(a,"bill:bill"))).ok).toBe(false);
});

it("redacts removed sources from receipts and drops state on membership removal", async () => {
  const initial = await read();
  const reviewed = await chooseWeeklyReview(db,owner,decide(initial,"bill:bill"),now);
  await finishWeeklyReview(db,owner,finish(reviewed),now);
  await db.query("UPDATE accounts SET workspace_id='personal:b',name='MOVED PRIVATE' WHERE id='bank'");
  const changed = await read();
  expect(changed.items.some(i=>i.kind==="bill")).toBe(false);
  expect(changed.receipts[0].items.some(i=>i.key==="bill:bill")).toBe(false);
  expect(JSON.stringify(changed)).not.toMatch(/Utility|MOVED PRIVATE/);
  await db.query("DELETE FROM workspace_members WHERE workspace_id='home' AND user_id='a'");
  await expect(read()).rejects.toThrow(/access/);
  expect((await db.query("SELECT * FROM weekly_review_receipts")).rows).toHaveLength(0);
});

it("keeps private activity out of summary counts, revision hashes and source links even for a household member", async () => {
  const initial = await read();
  await db.exec("INSERT INTO personal_ledgers(ledger_id,household_id,person_id) VALUES('personal:b','home','b')");
  const sharing={workspace:"personal:b",actor:"b",sessionId:randomUUID()};
  const choice={account:"secret",recipient:"a",photos:false};
  const preview=await previewAccountShare(db,sharing,choice);
  await confirmAccountShare(db,sharing,choice,preview.token,preview.expires);
  expect(await read()).toEqual(initial);
  await db.query("UPDATE recurring SET amount=987654 WHERE id='secret-bill'");
  await db.query("UPDATE goals SET target_amount=876543 WHERE id='secret-goal'");
  await db.query("UPDATE splits SET amount=765432 WHERE id='secret-iou'");
  expect(await read()).toEqual(initial);
  const shared=await db.query<{revision:string}>("SELECT revision FROM account_shares WHERE account_id='secret' AND recipient_id='a'");
  await stopAccountShare(db,sharing,"secret","a",shared.rows[0].revision);
  expect(await read()).toEqual(initial);
});

it("supports old deployments until the additive migration is applied", async () => {
  await db.exec("ALTER TABLE weekly_review_progress RENAME TO paused_weekly_review_progress");
  try { expect(await loadWeeklyReview(db, owner, now)).toBeNull(); }
  finally { await db.exec("ALTER TABLE paused_weekly_review_progress RENAME TO weekly_review_progress"); }
});
