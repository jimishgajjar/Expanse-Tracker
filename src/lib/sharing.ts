"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "./db";
import { invitations, users, workspaceMembers } from "./db/schema";
import { getCurrentUser } from "./session";
import { getActiveWorkspace } from "./workspace";
import { sendEmail } from "./email";

type Result = { ok: true } | { ok: false; error: string };

async function ctx() {
  const ws = await getActiveWorkspace();
  const me = await getCurrentUser();
  if (!ws || !me) return null;
  return { ws, me, isOwner: ws.ownerId === me.id };
}

export async function inviteMember(input: unknown): Promise<Result> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Not signed in." };
  if (!c.isOwner) return { ok: false, error: "Only the owner can invite people." };
  const parsed = z.object({ email: z.string().trim().email() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid email." };
  const email = parsed.data.email.toLowerCase();
  if (email === c.me.email.toLowerCase()) return { ok: false, error: "That's your own email." };

  const db = await getDb();
  const [u] = await db.select({ id: users.id, verifiedAt: users.emailVerifiedAt }).from(users).where(eq(users.email, email)).limit(1);
  // Only a verified account is added immediately; otherwise we store a pending
  // invite that's accepted when they confirm the address (closes the squatting hole).
  const addedNow = !!(u && u.verifiedAt);
  if (addedNow) {
    const [m] = await db.select().from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, c.ws.id), eq(workspaceMembers.userId, u!.id))).limit(1);
    if (m) return { ok: false, error: "They already have access." };
    await db.insert(workspaceMembers).values({ workspaceId: c.ws.id, userId: u!.id, role: "member" }).onConflictDoNothing();
  } else {
    await db.insert(invitations).values({ workspaceId: c.ws.id, email }).onConflictDoNothing();
  }

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = process.env.APP_URL || `${proto}://${host}`;
  await sendEmail(
    email,
    `${c.me.name || c.me.email} shared "${c.ws.name}" with you`,
    addedNow
      ? `<p>${c.me.name || c.me.email} shared their Money Tracker ("${c.ws.name}") with you.</p><p><a href="${base}/login">Sign in</a> and switch to it from the account menu.</p>`
      : `<p>${c.me.name || c.me.email} invited you to their Money Tracker ("${c.ws.name}").</p><p><a href="${base}/signup">Create your account</a> with this email (${email}) and confirm it — the shared tracker appears once your address is verified.</p>`,
  );
  revalidatePath("/");
  return { ok: true };
}

export async function removeInvite(email: string): Promise<Result> {
  const c = await ctx();
  if (!c || !c.isOwner) return { ok: false, error: "Only the owner can manage invites." };
  const db = await getDb();
  await db.delete(invitations).where(and(eq(invitations.workspaceId, c.ws.id), eq(invitations.email, email.toLowerCase())));
  revalidatePath("/");
  return { ok: true };
}

export async function removeMember(userId: string): Promise<Result> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Not signed in." };
  if (!c.isOwner) return { ok: false, error: "Only the owner can remove members." };
  if (userId === c.me.id) return { ok: false, error: "You're the owner — you can't remove yourself." };
  const db = await getDb();
  await db.delete(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, c.ws.id), eq(workspaceMembers.userId, userId)));
  revalidatePath("/");
  return { ok: true };
}

export async function leaveWorkspace(): Promise<Result> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Not signed in." };
  if (c.isOwner) return { ok: false, error: "Owners can't leave their own tracker." };
  const db = await getDb();
  await db.delete(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, c.ws.id), eq(workspaceMembers.userId, c.me.id)));
  revalidatePath("/");
  return { ok: true };
}
