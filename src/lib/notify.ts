import { eq, inArray } from "drizzle-orm";
import { getDb } from "./db";
import { pushSubscriptions, users, workspaceMembers } from "./db/schema";
import { sendEmail } from "./email";
import { pushConfigured, sendPushToSub, type PushPayload } from "./push";

export type Notice = { title: string; body: string; url?: string; tag?: string; emailHtml?: string };

/** Notify every member of a workspace via email + web push. Best-effort; never throws. */
export async function notifyWorkspace(workspaceId: string, n: Notice): Promise<void> {
  try {
    const db = await getDb();
    const members = await db
      .select({ userId: users.id, email: users.email })
      .from(workspaceMembers)
      .innerJoin(users, eq(workspaceMembers.userId, users.id))
      .where(eq(workspaceMembers.workspaceId, workspaceId));
    if (!members.length) return;

    const base = process.env.APP_URL || "";
    const link = n.url ? `${base}${n.url}` : base || undefined;
    const html =
      n.emailHtml ??
      `<p>${n.body}</p>${link ? `<p><a href="${link}">Open Expense Tracker</a></p>` : ""}`;
    await Promise.allSettled(members.map((m) => sendEmail(m.email, n.title, html)));

    if (pushConfigured()) {
      const subs = await db
        .select()
        .from(pushSubscriptions)
        .where(inArray(pushSubscriptions.userId, members.map((m) => m.userId)));
      const payload: PushPayload = { title: n.title, body: n.body, url: n.url, tag: n.tag };
      const results = await Promise.allSettled(subs.map((s) => sendPushToSub(s, payload)));
      const dead = results.flatMap((r, i) => (r.status === "fulfilled" && r.value.gone ? [subs[i].endpoint] : []));
      if (dead.length) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.endpoint, dead));
    }
  } catch (e) {
    console.error("[notify] failed:", e);
  }
}
