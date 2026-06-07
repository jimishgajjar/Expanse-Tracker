"use server";

import { revalidatePath } from "next/cache";
import { requestBaseUrl } from "./base-url";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "./db";
import { invitations, users, workspaceMembers, workspaces } from "./db/schema";
import { getCurrentUser } from "./session";
import { getActiveWorkspace } from "./workspace";
import { sendEmail } from "./email";
import { renderEmail, escapeHtml } from "./email-template";

type Result = { ok: true } | { ok: false; error: string };
type InviteResult =
  | { ok: true; member?: { id: string; email: string; name: string; role: string }; invite?: string }
  | { ok: false; error: string };

async function ctx() {
  const ws = await getActiveWorkspace();
  const me = await getCurrentUser();
  if (!ws || !me) return null;
  return { ws, me, isOwner: ws.ownerId === me.id };
}

export async function inviteMember(input: unknown): Promise<InviteResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Not signed in." };
  if (!c.isOwner) return { ok: false, error: "Only the owner can invite people." };
  const parsed = z.object({ email: z.string().trim().email(), role: z.enum(["member", "viewer"]).optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid email." };
  const email = parsed.data.email.toLowerCase();
  const role = parsed.data.role === "viewer" ? "viewer" : "member";
  if (email === c.me.email.toLowerCase()) return { ok: false, error: "That's your own email." };

  const db = await getDb();
  const [u] = await db.select({ id: users.id, name: users.name, verifiedAt: users.emailVerifiedAt }).from(users).where(eq(users.email, email)).limit(1);
  // Only a verified account is added immediately; otherwise we store a pending
  // invite that's accepted when they confirm the address (closes the squatting hole).
  const addedNow = !!(u && u.verifiedAt);
  if (addedNow) {
    const [m] = await db.select().from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, c.ws.id), eq(workspaceMembers.userId, u!.id))).limit(1);
    if (m) return { ok: false, error: "They already have access." };
    await db.insert(workspaceMembers).values({ workspaceId: c.ws.id, userId: u!.id, role }).onConflictDoNothing();
  } else {
    await db.insert(invitations).values({ workspaceId: c.ws.id, email, role }).onConflictDoNothing();
  }

  const base = await requestBaseUrl();
  const inviter = c.me.name || c.me.email;
  const access = role === "viewer" ? "View only" : "Can edit";
  await sendEmail(
    email,
    `${inviter} shared "${c.ws.name}" with you`,
    addedNow
      ? renderEmail({
          heading: `${inviter} shared a tracker with you`,
          intro: `You now have ${role === "viewer" ? "view-only" : "full editing"} access to “${escapeHtml(c.ws.name)}” on Expense Tracker. Sign in and switch to it from the tracker menu.`,
          detail: { rows: [{ label: "Tracker", value: c.ws.name }, { label: "Your access", value: access }] },
          cta: { label: "Sign in", url: `${base}/login` },
          footnote: "If you weren't expecting this, you can ignore this email.",
        })
      : renderEmail({
          heading: `${inviter} invited you to a tracker`,
          intro: `${escapeHtml(inviter)} invited you to “${escapeHtml(c.ws.name)}” on Expense Tracker. Create your account with this email and confirm it — the shared tracker appears once your address is verified.`,
          detail: { rows: [{ label: "Tracker", value: c.ws.name }, { label: "Invited email", value: email }, { label: "Your access", value: access }] },
          cta: { label: "Create your account", url: `${base}/signup` },
          footnote: "If you weren't expecting this, you can ignore this email.",
        }),
  );
  revalidatePath("/");
  return addedNow ? { ok: true, member: { id: u!.id, email, name: u!.name, role } } : { ok: true, invite: email };
}

export async function transferOwnership(userId: string): Promise<Result> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Not signed in." };
  if (!c.isOwner) return { ok: false, error: "Only the owner can transfer ownership." };
  if (userId === c.me.id) return { ok: false, error: "You already own this tracker." };
  const db = await getDb();
  const [m] = await db.select().from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, c.ws.id), eq(workspaceMembers.userId, userId))).limit(1);
  if (!m) return { ok: false, error: "That person isn't a member." };
  await db.update(workspaces).set({ ownerId: userId }).where(eq(workspaces.id, c.ws.id));
  await db.update(workspaceMembers).set({ role: "owner" }).where(and(eq(workspaceMembers.workspaceId, c.ws.id), eq(workspaceMembers.userId, userId)));
  await db.update(workspaceMembers).set({ role: "member" }).where(and(eq(workspaceMembers.workspaceId, c.ws.id), eq(workspaceMembers.userId, c.me.id)));
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
