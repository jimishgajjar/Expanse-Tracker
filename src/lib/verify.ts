import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { emailVerifications, invitations, users, workspaceMembers } from "./db/schema";
import { sendEmail } from "./email";

async function baseUrl() {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return process.env.APP_URL || `${proto}://${host}`;
}

/** Create a single-use token and email a confirmation link (24h expiry). */
export async function sendVerificationEmail(userId: string, email: string, name: string) {
  const db = await getDb();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.insert(emailVerifications).values({ id: token, userId, expiresAt });
  const link = `${await baseUrl()}/verify?token=${token}`;
  await sendEmail(
    email,
    "Confirm your Money Tracker email",
    `<p>Hi ${name || "there"},</p>
     <p>Confirm your email address to finish setting up your account and unlock shared trackers.</p>
     <p><a href="${link}">Verify email</a></p>
     <p>Or paste this link into your browser:<br>${link}</p>
     <p>This link expires in 24 hours.</p>`,
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
  const invites = await db.select().from(invitations).where(eq(invitations.email, addr));
  for (const inv of invites) {
    await db.insert(workspaceMembers).values({ workspaceId: inv.workspaceId, userId, role: inv.role }).onConflictDoNothing();
  }
  if (invites.length) await db.delete(invitations).where(eq(invitations.email, addr));
  return invites.length;
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
