import { and, eq, exists, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb } from "./db";
import { commentMentions, invitationPreferences, notificationPreferences as prefs, pushSubscriptions as devices, transactionComments, transactions, users, workspaceMembers as members } from "./db/schema";
import { emailConfigured, sendEmail } from "./email";
import { renderEmail, type EmailDetail } from "./email-template";
import { householdRoles, isPersonalLedger } from "./household-access";
import { topicLabels, type DeliveryChannel, type NotificationTopic } from "./notification-options";
import { personalPreviewEnabled } from "./personal-preview";
import { localPersonalDb } from "./local-personal-db";
import { hostedHouseholdEnabled } from "./household-features";
import { pushConfigured, sendPushToSub } from "./push";

type Audience =
  | {topic:Exclude<NotificationTopic,"invitation"|"mention">}
  | {topic:"invitation"; recipient:string; membershipCreated:string}
  | {topic:"mention"; comment:string};

export type Notice = Audience & {
  title: string; body: string; url?: string; tag?: string;
  heading?: string; intro?: string; detail?: EmailDetail; ctaLabel?: string; emailHtml?: string;
};

/** Select a fresh audience per channel, including when queued notices are flushed later.
 * Returns the number of eligible destinations. Provider delivery remains best-effort. */
export async function notifyWorkspace(workspace: string, notice: Notice): Promise<number> {
  if (isPersonalLedger(workspace)) return 0;
  const preview = personalPreviewEnabled();
  let count = 0;
  try {
    if (preview) await localPersonalDb();
    const db = await getDb();
    const membership = and(eq(members.workspaceId,workspace),inArray(members.role,householdRoles));
    function audience(channel:DeliveryChannel) {
      if (notice.topic === "invitation") return and(membership,eq(members.userId,notice.recipient),isNotNull(users.emailVerifiedAt),
        sql`${members.createdAt} = ${notice.membershipCreated}::timestamp`,
        exists(db.select({one:sql`1`}).from(invitationPreferences).where(and(eq(invitationPreferences.userId,members.userId),eq(invitationPreferences.channel,channel)))));
      const optedIn = exists(db.select({one:sql`1`}).from(prefs).where(and(eq(prefs.workspaceId,workspace),
        eq(prefs.userId,members.userId),eq(prefs.topic,notice.topic),eq(prefs.channel,channel))));
      if (notice.topic !== "mention") return and(membership,optedIn);
      const mentioned = exists(db.select({one:sql`1`}).from(commentMentions)
        .innerJoin(transactionComments,eq(transactionComments.id,commentMentions.commentId))
        .innerJoin(transactions,eq(transactions.id,transactionComments.transactionId))
        .where(and(eq(commentMentions.commentId,notice.comment),eq(commentMentions.userId,members.userId),
          eq(commentMentions.workspaceId,workspace),eq(transactions.workspaceId,workspace),isNotNull(transactionComments.body))));
      return and(membership,optedIn,mentioned);
    }
    // A staged rehearsal can contact only its explicitly designated test recipient.
    const staging = process.env.HOUSEHOLD_RELEASE === "staging" && hostedHouseholdEnabled();
    const recipient = staging ? eq(users.email, process.env.M7_TEST_EMAIL?.trim().toLowerCase() || "") : undefined;
    const emails = await db.select({email:users.email}).from(members).innerJoin(users,eq(users.id,members.userId))
      .where(and(audience("email"),recipient,isNotNull(users.emailVerifiedAt)));
    if (emails.length && !preview && emailConfigured()) {
      const base = staging && process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : process.env.APP_URL;
      const html = notice.emailHtml ?? renderEmail({
        preheader:notice.body, heading:notice.heading ?? notice.title, intro:notice.intro ?? notice.body,
        detail:notice.detail, cta:base ? {label:notice.ctaLabel ?? "Open Expense Tracker",url:base + (notice.url ?? "/")} : undefined,
        footnote:"You selected email for this notification in Settings.",
      });
      await Promise.allSettled(emails.map(({email}) => sendEmail(email,notice.title,html)));
    }
    if (preview || emailConfigured()) count += emails.length;

    const subscriptions = await db.select({id:devices.id,userId:devices.userId,endpoint:devices.endpoint,p256dh:devices.p256dh,auth:devices.auth})
      .from(members).innerJoin(users,eq(users.id,members.userId)).innerJoin(devices,eq(devices.userId,members.userId))
      .where(and(audience("push"),recipient));
    const eligible = subscriptions.filter(sub => preview || sub.p256dh === "expo" || pushConfigured());
    if (!preview) {
      // A lock screen can be visible to someone other than the signed-in member.
      const payload = {title:topicLabels[notice.topic],body:"Open Expense Tracker to review your household update.",url:notice.url,tag:notice.tag};
      await Promise.allSettled(eligible.map(async sub => {
        const result = await sendPushToSub(sub,payload,workspace);
        if (result.gone) await db.delete(devices).where(and(eq(devices.id,sub.id),eq(devices.userId,sub.userId),eq(devices.p256dh,sub.p256dh),eq(devices.auth,sub.auth)));
      }));
    }
    count += eligible.length;
    if (preview && count) console.info("[notifications:preview]",notice.topic,{email:emails.length,push:eligible.length});
  } catch {
    console.error("[notifications] Could not process household notification.");
  }
  return count;
}

export function notifyInvitation(workspace:string, recipient:string, membershipCreated:string) {
  return notifyWorkspace(workspace,{topic:"invitation",recipient,membershipCreated,
    title:"A tracker was shared with you",body:"Sign in and open the tracker menu to see your households.",url:"/?tab=settings"});
}
