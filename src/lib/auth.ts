"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { users, workspaceMembers, workspaces } from "./db/schema";
import { hashPassword, verifyPassword } from "./password";
import { createSession, destroySession, getCurrentUser } from "./session";
import { seed } from "./db/seed";
import { sendVerificationEmail } from "./verify";
import { rateLimit, clientIp, retryMessage } from "./rate-limit";

const emailSchema = z.string().trim().email("Enter a valid email");
const passwordSchema = z.string().min(8, "Password must be at least 8 characters");

async function defaultWorkspaceId(userId: string): Promise<string | null> {
  const db = await getDb();
  const [owned] = await db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.ownerId, userId)).limit(1);
  if (owned) return owned.id;
  const [m] = await db.select({ id: workspaceMembers.workspaceId }).from(workspaceMembers).where(eq(workspaceMembers.userId, userId)).limit(1);
  return m?.id ?? null;
}

export async function signup(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const emailP = emailSchema.safeParse(formData.get("email"));
  if (!emailP.success) return emailP.error.issues[0].message;
  const pwP = passwordSchema.safeParse(formData.get("password"));
  if (!pwP.success) return pwP.error.issues[0].message;
  const email = emailP.data.toLowerCase();
  const name = String(formData.get("name") ?? "").trim();

  const limited = await rateLimit(`signup:${clientIp(await headers())}`, 10, 60 * 60 * 1000);
  if (!limited.ok) return retryMessage(limited.retryAfterSec);

  const db = await getDb();
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length) return "An account with this email already exists.";

  // New user → their own personal tracker.
  const [u] = await db.insert(users).values({ email, name, passwordHash: hashPassword(pwP.data) }).returning();
  const [w] = await db
    .insert(workspaces)
    .values({ name: `${name || email.split("@")[0]}'s tracker`, ownerId: u.id })
    .returning();
  await db.insert(workspaceMembers).values({ workspaceId: w.id, userId: u.id, role: "owner" });
  await seed(db, w.id); // default accounts + categories (no sample transactions)

  // Shared access is gated on email verification: any pending invitations for
  // this address are accepted only after the link is clicked (see verifyEmailToken).
  await sendVerificationEmail(u.id, email, name);

  await createSession(u.id, w.id);
  redirect("/");
}

export async function login(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const emailP = emailSchema.safeParse(formData.get("email"));
  if (!emailP.success) return "Incorrect email or password.";
  const password = String(formData.get("password") ?? "");

  const limited = await rateLimit(`login:${emailP.data.toLowerCase()}`, 8, 10 * 60 * 1000);
  if (!limited.ok) return retryMessage(limited.retryAfterSec);

  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.email, emailP.data.toLowerCase())).limit(1);
  if (!u || !verifyPassword(password, u.passwordHash)) return "Incorrect email or password.";
  await createSession(u.id, await defaultWorkspaceId(u.id));
  redirect(String(formData.get("next") || "/"));
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

export async function changePassword(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const user = await getCurrentUser();
  if (!user) return "You're not signed in.";
  const current = String(formData.get("current") ?? "");
  const nextP = passwordSchema.safeParse(formData.get("newPassword"));
  if (!nextP.success) return nextP.error.issues[0].message;
  if (!verifyPassword(current, user.passwordHash)) return "Current password is incorrect.";

  const db = await getDb();
  await db.update(users).set({ passwordHash: hashPassword(nextP.data) }).where(eq(users.id, user.id));
  return "ok";
}

export async function resendVerification(): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You're not signed in." };
  if (user.emailVerifiedAt) return { ok: true };
  const limited = await rateLimit(`resend:${user.id}`, 3, 15 * 60 * 1000);
  if (!limited.ok) return { ok: false, error: retryMessage(limited.retryAfterSec) };
  await sendVerificationEmail(user.id, user.email, user.name);
  return { ok: true };
}

export async function deleteAccount(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const user = await getCurrentUser();
  if (!user) return "You're not signed in.";
  if (!verifyPassword(String(formData.get("password") ?? ""), user.passwordHash)) return "Password is incorrect.";

  // Cascades: owned workspaces (and their data), memberships, and sessions all go.
  // Transactions this user created in *other* people's trackers keep their data
  // (created_by is set to null) so shared history isn't lost.
  const db = await getDb();
  await db.delete(users).where(eq(users.id, user.id));
  await destroySession();
  redirect("/signup");
}
