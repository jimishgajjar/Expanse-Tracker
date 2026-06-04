"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "./db";
import { invitations, users } from "./db/schema";
import { getCurrentUser } from "./session";
import { sendEmail } from "./email";

type Result = { ok: true } | { ok: false; error: string };

export async function inviteMember(input: unknown): Promise<Result> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in." };
  const parsed = z.object({ email: z.string().trim().email() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid email." };
  const email = parsed.data.email.toLowerCase();

  const db = await getDb();
  const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existingUser) return { ok: false, error: "That person already has access." };
  await db.insert(invitations).values({ email }).onConflictDoNothing();

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = process.env.APP_URL || `${proto}://${host}`;
  await sendEmail(
    email,
    `${me.name || me.email} shared their Money Tracker with you`,
    `<p>${me.name || me.email} has invited you to their Money Tracker.</p>
     <p><a href="${base}/signup">Create your account</a> using this email address (${email}) to get access.</p>`,
  );
  revalidatePath("/");
  return { ok: true };
}

export async function removeInvite(email: string): Promise<Result> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in." };
  const db = await getDb();
  await db.delete(invitations).where(eq(invitations.email, email.toLowerCase()));
  revalidatePath("/");
  return { ok: true };
}

export async function removeMember(userId: string): Promise<Result> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in." };
  if (userId === me.id) return { ok: false, error: "You can't remove yourself." };
  const db = await getDb();
  await db.delete(users).where(eq(users.id, userId)); // cascades sessions
  revalidatePath("/");
  return { ok: true };
}
