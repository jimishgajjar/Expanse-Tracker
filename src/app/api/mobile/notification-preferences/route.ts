import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { invitationPreferences as invites, notificationPreferences as prefs } from "@/lib/db/schema";
import { isPersonalLedger } from "@/lib/household-access";
import { localPersonalDb } from "@/lib/local-personal-db";
import { deliveryChannels, notificationTopics, topicLabels, type NotificationOptions } from "@/lib/notification-options";
import { getSession } from "@/lib/session";
import { personalPreviewEnabled } from "@/lib/personal-preview";
import { getActiveWorkspaceId } from "@/lib/workspace";

const change = z.strictObject({topic:z.enum(notificationTopics), channel:z.enum(deliveryChannels), enabled:z.boolean()});
const json = (data: unknown, status = 200) => Response.json(data, {status, headers: {"Cache-Control":"private, no-store"}});

async function preferences(request: Request, write: boolean) {
  const session = await getSession();
  if (!session) return json({error:"Sign in again to continue."}, 401);
  const workspace = await getActiveWorkspaceId();
  if (!workspace) return json({error:"Choose an accessible tracker."}, 403);
  if (new URL(request.url).searchParams.get("workspace") !== workspace) return json({error:"Reopen the current tracker."}, 409);
  const actor = session.user.id;
  const personal = isPersonalLedger(workspace);
  const own = and(eq(prefs.workspaceId,workspace),eq(prefs.userId,actor));
  await localPersonalDb(); // Bring an already-running embedded preview up to date.
  const db = await getDb();
  if (write) {
    const input = change.safeParse(await request.json().catch(() => null));
    if (!input.success) return json({error:"Choose a notification and delivery channel."}, 400);
    const {topic, channel, enabled} = input.data;
    if (enabled && channel === "email" && !session.user.emailVerifiedAt) return json({error:"Verify your email address first."}, 400);
    if (topic === "invitation") {
      if (enabled) await db.insert(invites).values({userId:actor,channel}).onConflictDoNothing();
      else await db.delete(invites).where(and(eq(invites.userId,actor),eq(invites.channel,channel)));
    } else if (personal) {
      return json({error:"Choose a household tracker for this notification."},403);
    } else if (enabled) {
      await db.execute(sql`INSERT INTO notification_preferences (workspace_id,user_id,topic,channel)
        SELECT workspace_id,user_id,${topic},${channel} FROM workspace_members
        WHERE workspace_id=${workspace} AND user_id=${actor} AND role IN ('owner','member','viewer')
        ON CONFLICT DO NOTHING`);
    } else {
      await db.delete(prefs).where(and(own,eq(prefs.topic,topic),eq(prefs.channel,channel)));
    }
  }
  const [household, account] = await Promise.all([
    personal ? [] : db.select({topic:prefs.topic,channel:prefs.channel}).from(prefs).where(own),
    db.select({channel:invites.channel}).from(invites).where(eq(invites.userId,actor)),
  ]);
  const rows = [...household,...account.map(row => ({...row,topic:"invitation" as const}))];
  return json({
    emailVerified: !!session.user.emailVerifiedAt,
    preview: personalPreviewEnabled(),
    choices: notificationTopics.filter(topic => !personal || topic === "invitation").map(topic => ({
      topic, label:topicLabels[topic],
      email:rows.some(row => row.topic === topic && row.channel === "email"),
      push:rows.some(row => row.topic === topic && row.channel === "push"),
    })),
  } satisfies NotificationOptions);
}

export const GET = (request: Request) => preferences(request, false);
export const PATCH = (request: Request) => preferences(request, true);
