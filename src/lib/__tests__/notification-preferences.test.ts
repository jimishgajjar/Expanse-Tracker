import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../db/schema";
import type { AppDb } from "../db";
import type { NotificationOptions, NotificationTopic, DeliveryChannel } from "../notification-options";

const state = vi.hoisted(() => ({db:null as unknown as AppDb, actor:"a", workspace:"home", verified:true, preview:false,
  mail:vi.fn(), push:vi.fn()}));
vi.mock("../db",()=>({getDb:async()=>state.db}));
vi.mock("../session",()=>({getSession:async()=>state.actor ? {user:{id:state.actor,emailVerifiedAt:state.verified ? new Date() : null},workspaceId:state.workspace} : null,
  getCurrentUser:async()=>state.actor ? {id:state.actor,email:state.actor+"@example.test"} : null}));
vi.mock("next/cache",()=>({revalidatePath:()=>{}}));
vi.mock("../personal-preview",()=>({personalPreviewEnabled:()=>state.preview}));
vi.mock("../email",()=>({emailConfigured:()=>true,sendEmail:state.mail}));
vi.mock("../push",()=>({sendPushToSub:state.push,pushConfigured:()=>true}));

import { GET, PATCH } from "@/app/api/mobile/notification-preferences/route";
import { notifyInvitation, notifyWorkspace, type Notice } from "../notify";
import { inviteMember } from "../sharing";
import { acceptPendingInvites } from "../verify";
import { postComment, removeComment } from "../transaction-comments";
import { flushNotices, processRecurring } from "../queries";
import { checkBudgetAlerts, sendMonthlyDigests } from "../cron-tasks";
import { addDays,format } from "date-fns";

const pg = new PGlite();
const req = (workspace=state.workspace) => new Request("http://localhost/api/mobile/notification-preferences?workspace="+workspace);
const write = (body:unknown, workspace=state.workspace) => PATCH(new Request(req(workspace),{method:"PATCH",body:JSON.stringify(body)}));
const opt = (topic:NotificationTopic,channel:DeliveryChannel,enabled=true) => write({topic,channel,enabled});
const notice:Notice = {topic:"upcoming",title:"Shared payment",body:"Sensitive household amount",url:"/?tab=planning"};
beforeAll(async()=>{
  const db=drizzle(pg,{schema}); await migrate(db,{migrationsFolder:"./drizzle"}); state.db=db as unknown as AppDb;
  await pg.exec(`INSERT INTO users(id,email,password_hash,email_verified_at) SELECT who,who||'@example.test','x',now() FROM unnest(ARRAY['a','b','c']) who;
    INSERT INTO workspaces(id,name,owner_id) VALUES('home','Household','a'),('away','Another household','a');
    INSERT INTO workspace_members(workspace_id,user_id,role) VALUES ('home','a','owner'),('away','a','owner'),('home','b','viewer'),('away','c','member');
    INSERT INTO push_subscriptions(id,user_id,endpoint,p256dh,auth) VALUES ('dev-a','a','device-a','web','x'),('dev-b','b','device-b','expo','native');
    INSERT INTO transactions(id,workspace_id,type,amount,date,note) VALUES ('joint','home','expense',24,'2026-11-04','Household receipt'),
      ('private','away','expense',999,'2026-11-04','Foreign receipt');`);
},60000);
beforeEach(async()=>{
  state.actor="a";state.workspace="home";state.verified=true;state.preview=false;
  state.mail.mockReset();state.push.mockReset().mockResolvedValue({ok:true,gone:false});
  await pg.exec("DELETE FROM invitation_preferences; DELETE FROM notification_preferences; DELETE FROM app_settings;");
});
afterAll(async()=>{await pg.close();});

it("starts off, lets a viewer change only their choices, and rejects stale trackers and forged recipients",async()=>{
  expect(await notifyWorkspace("home",notice)).toBe(0);
  const response=await GET(req());expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  const empty:NotificationOptions=await response.json();expect(empty.choices).toHaveLength(6);
  expect(empty.choices.every(row=>!row.email && !row.push)).toBe(true);
  state.actor="b";expect((await opt("upcoming","push")).status).toBe(200);
  expect((await opt("upcoming","push")).status).toBe(200);
  expect((await write({topic:"monthly",channel:"email",enabled:true,userId:"a"})).status).toBe(400);
  expect((await write({topic:"invite",channel:"push",enabled:true})).status).toBe(400);
  expect((await GET(req("away"))).status).toBe(409);
  state.actor="a";expect((await (await GET(req())).json()).choices).toEqual(empty.choices);
  state.actor="c";expect((await opt("posted","push")).status).toBe(403);
  state.actor="";expect((await GET(req())).status).toBe(401);
});

it("dispatches only the selected topic/channel for the current household and rechecks after queuing",async()=>{
  await opt("upcoming","email");
  state.workspace="away";await opt("upcoming","push");state.workspace="home";
  state.actor="b";await opt("posted","email");await opt("upcoming","push");
  await flushNotices([{workspaceId:"home",notice}]);
  expect(state.mail.mock.calls.map(args=>args[0])).toEqual(["a@example.test"]);
  expect(state.push.mock.calls.map(args=>args[0].endpoint)).toEqual(["device-b"]);
  expect(JSON.stringify(state.push.mock.calls[0][1])).not.toContain(notice.body);
  state.mail.mockClear();state.push.mockClear();
  await opt("upcoming","push",false);
  state.actor="a";await opt("upcoming","email",false);
  await flushNotices([{workspaceId:"home",notice}]);
  expect(state.mail).not.toHaveBeenCalled();expect(state.push).not.toHaveBeenCalled();
  await opt("budget","email");await notifyWorkspace("home",{...notice,topic:"budget"});
  expect(state.mail).toHaveBeenCalledOnce();
});

it("stops sending when membership ends, on rejoin, and when email verification is lost",async()=>{
  state.actor="b";await opt("upcoming","email");await opt("upcoming","push");
  await pg.exec("DELETE FROM workspace_members WHERE workspace_id='home' AND user_id='b'");
  expect((await GET(req())).status).toBe(403);
  expect(await notifyWorkspace("home",notice)).toBe(0);
  await pg.exec("INSERT INTO workspace_members(workspace_id,user_id,role) VALUES ('home','b','member')");
  expect(await notifyWorkspace("home",notice)).toBe(0);
  await opt("upcoming","email");
  try {
    await pg.exec("UPDATE users SET email_verified_at=null WHERE id='b'");state.verified=false;
    expect(await notifyWorkspace("home",notice)).toBe(0);
    expect((await opt("monthly","email")).status).toBe(400);
    expect((await opt("upcoming","email",false)).status).toBe(200);
  } finally { await pg.exec("UPDATE users SET email_verified_at=now() WHERE id='b'"); }
});

it("honours different monthly digest channels, a paused household digest, and overlapping cron runs",async()=>{
  const day=new Date(2026,11,1,12);
  await opt("monthly","push");state.actor="b";await opt("monthly","email");
  await pg.exec("INSERT INTO app_settings(workspace_id,digest_enabled) VALUES('home',false)");
  expect(await sendMonthlyDigests(day)).toBe(0);
  await pg.exec("UPDATE app_settings SET digest_enabled=true WHERE workspace_id='home'");
  const runs=await Promise.all([sendMonthlyDigests(day),sendMonthlyDigests(day)]);
  expect(runs.sort()).toEqual([0,1]);
  expect(state.mail.mock.calls.map(args=>args[0])).toEqual(["b@example.test"]);
  expect(state.mail.mock.calls[0][2]).toContain("Household receipt");
  expect(state.mail.mock.calls[0][2]).not.toContain("Foreign receipt");
  expect(state.push.mock.calls.map(args=>args[0].endpoint)).toEqual(["device-a"]);
});

it("never delivers from private trackers and exercises preview routing without contacting either provider",async()=>{
  await opt("upcoming","email");await opt("upcoming","push");
  expect(await notifyWorkspace("personal:mine",notice)).toBe(0);
  state.preview=true;
  expect(await notifyWorkspace("home",notice)).toBe(2);
  expect(state.mail).not.toHaveBeenCalled();expect(state.push).not.toHaveBeenCalled();
});

it("uses the invitee's account choice from another household, once per new grant",async()=>{
  state.actor="b"; await opt("invitation","push");
  state.actor="a"; await opt("invitation","email"); state.workspace="away";
  const add=()=>inviteMember({email:"b@example.test",role:"viewer"});
  const results=await Promise.all([add(),add()]);
  expect(results.filter(r=>r.ok)).toHaveLength(1);
  expect(state.mail).not.toHaveBeenCalled();
  expect(state.push.mock.calls.map(args=>args[0].endpoint)).toEqual(["device-b"]);
  state.actor="b";
  const prefs:NotificationOptions=await (await GET(req())).json();
  expect(prefs.choices.find(row=>row.topic==="invitation")).toMatchObject({push:true,email:false});
  const {rows:[old]}=await pg.query<{created:string}>("SELECT created_at::text AS created FROM workspace_members WHERE workspace_id='away' AND user_id='b'");
  await pg.exec("DELETE FROM workspace_members WHERE workspace_id='away' AND user_id='b'; INSERT INTO workspace_members(workspace_id,user_id,role) VALUES('away','b','viewer')");
  expect(await notifyInvitation("away","b",old.created)).toBe(0);
  await pg.exec("DELETE FROM workspace_members WHERE workspace_id='away' AND user_id='b'");
});

it("keeps unknown addresses pending without messaging and only notifies upon verified acceptance and explicit opt-in",async()=>{
  const email="new@example.test";
  expect(await inviteMember({email})).toEqual({ok:true,invite:email});
  expect(await inviteMember({email})).toEqual({ok:true,invite:email});
  expect(state.mail).not.toHaveBeenCalled();expect(state.push).not.toHaveBeenCalled();
  await pg.query("INSERT INTO users(id,email,password_hash) VALUES ('new',$1,'x')",[email]);
  expect(await acceptPendingInvites("new",email)).toBe(0);
  await pg.exec("UPDATE users SET email_verified_at=now() WHERE id='new'");
  expect(await acceptPendingInvites("c",email)).toBe(0);
  expect(await acceptPendingInvites("new",email)).toBe(1);
  expect(await acceptPendingInvites("new",email)).toBe(0);
  expect(state.mail).not.toHaveBeenCalled();expect(state.push).not.toHaveBeenCalled();
  await pg.exec("DELETE FROM workspace_members WHERE workspace_id='home' AND user_id='new'; INSERT INTO invitations(workspace_id,email) VALUES ('home','new@example.test'); INSERT INTO invitation_preferences VALUES ('new','email')");
  expect(await acceptPendingInvites("new",email)).toBe(1);
  expect(state.mail.mock.calls.map(args=>args[0])).toEqual([email]);
});

it("targets only explicitly mentioned members, rechecks scope per channel, and drops deleted mentions",async()=>{
  const scope={workspace:"home",actor:"a"};
  const comment=await postComment(pg,scope,"joint",{body:"Synthetic financial detail",mentions:["b"],requestId:crypto.randomUUID()});
  const mention:Notice={topic:"mention",comment:comment.id,title:"Transaction comment",body:"Open the conversation."};
  await opt("mention","email"); state.actor="b"; await opt("mention","push");
  expect(await notifyWorkspace("home",mention)).toBe(1);
  expect(state.mail).not.toHaveBeenCalled();expect(state.push.mock.calls[0][0].endpoint).toBe("device-b");
  expect(JSON.stringify(state.push.mock.calls)).not.toContain("Synthetic financial detail");
  expect(await notifyWorkspace("away",mention)).toBe(0);
  await opt("mention","email"); state.mail.mockImplementationOnce(()=>opt("mention","push",false));
  state.push.mockClear();
  expect(await notifyWorkspace("home",mention)).toBe(1);
  expect(state.mail.mock.calls[0][0]).toBe("b@example.test"); expect(state.push).not.toHaveBeenCalled();
  await removeComment(pg,scope,"joint",comment.id);
  expect(await notifyWorkspace("home",mention)).toBe(0);
});

it("routes the real upcoming, posted and budget triggers and respects schedule-level alerts",async()=>{
  const now=new Date(),today=format(now,"yyyy-MM-dd"),tomorrow=format(addDays(now,1),"yyyy-MM-dd");
  await pg.query(`INSERT INTO recurring(id,workspace_id,type,amount,frequency,next_date,alerts_enabled)
    VALUES ('due','home','expense',20,'monthly',$1,true),('next','home','expense',9,'monthly',$2,true),
    ('quiet','home','expense',5,'monthly',$2,false)`,[today,tomorrow]);
  await opt("posted","email");state.actor="b";await opt("upcoming","push");
  const notices=await processRecurring();
  expect(notices.map(n=>n.notice.topic).sort()).toEqual(["posted","upcoming"]);
  await flushNotices(notices);
  expect(state.mail.mock.calls.map(args=>args[0])).toEqual(["a@example.test"]);
  expect(state.push.mock.calls.map(args=>args[0].endpoint)).toEqual(["device-b"]);
  await opt("budget","email");
  await pg.exec("INSERT INTO categories(id,workspace_id,name,kind) VALUES ('food','home','Food','expense'); INSERT INTO budgets(id,workspace_id,category_id,amount) VALUES ('limit','home','food',100)");
  await pg.query("INSERT INTO transactions(id,workspace_id,type,category_id,date,amount) VALUES ('meal','home','expense','food',$1,85)",[today]);
  expect(await checkBudgetAlerts(now)).toBe(1);
  expect(await checkBudgetAlerts(now)).toBe(0);
  expect(state.mail.mock.calls.map(args=>args[0])).toEqual(["a@example.test","b@example.test"]);
});
