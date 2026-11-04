import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { getDb } from "./db";
import { emailVerifications, users } from "./db/schema";
import { notifyInvitation } from "./notify";
import { sendEmail } from "./email";
import { renderEmail, escapeHtml } from "./email-template";
import { requestBaseUrl as baseUrl } from "./base-url";

/** Create a single-use token and email a confirmation link (24h expiry). */
export async function sendVerificationEmail(userId: string, email: string, name: string) {
  const db = await getDb();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.insert(emailVerifications).values({ id: token, userId, expiresAt });
  const link = `${await baseUrl()}/verify?token=${token}`;
  await sendEmail(
    email,
    "Confirm your Expense Tracker email",
    renderEmail({
      heading: "Confirm your email",
      intro: `Hi ${escapeHtml(name || "there")}, confirm your email address to finish setting up your account and unlock shared trackers.`,
      cta: { label: "Verify email", url: link },
      footnote: "This link expires in 24 hours. If you didn't create an Expense Tracker account, you can ignore this email.",
    }),
  );
}

/**
 * Accept any pending workspace invitations addressed to this email — called only
 * once the address is proven (on verification), so nobody can claim a shared
 * tracker for an inbox they don't control.
 */
export async function acceptPendingInvites(userId: string, email: string): Promise<number> {
  const db = await getDb();
  const addr = email.toLowerCase();
  const joined = await db.execute<{workspace:string; created:string}>(sql`
    WITH accepted AS (
      DELETE FROM invitations WHERE email=${addr} AND workspace_id NOT LIKE 'personal:%'
        AND EXISTS (SELECT 1 FROM users WHERE id=${userId} AND email=${addr} AND email_verified_at IS NOT NULL)
      RETURNING workspace_id,role
    )
    INSERT INTO workspace_members(workspace_id,user_id,role)
    SELECT workspace_id,${userId},role FROM accepted ON CONFLICT DO NOTHING
    RETURNING workspace_id AS workspace,created_at::text AS created`);
  for (const member of joined.rows) await notifyInvitation(member.workspace,userId,member.created);
  return joined.rows.length;
}

/** Validate a verification token: mark the user verified and accept pending invites. */
export async function verifyEmailToken(token: string): Promise<{ ok: boolean; joined?: number; error?: string }> {
  if (!token) return { ok: false, error: "Missing verification token." };
  const db = await getDb();
  const [row] = await db.select().from(emailVerifications).where(eq(emailVerifications.id, token)).limit(1);
  if (!row || row.expiresAt.getTime() < Date.now()) return { ok: false, error: "This link is invalid or has expired." };
  const [u] = await db.select().from(users).where(eq(users.id, row.userId)).limit(1);
  if (!u) return { ok: false, error: "Account not found." };

  await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, u.id));
  await db.delete(emailVerifications).where(eq(emailVerifications.id, token));
  const joined = await acceptPendingInvites(u.id, u.email);
  return { ok: true, joined };
}
