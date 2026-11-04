"use server";

import { revalidatePath } from "next/cache";
import { notifyInvitation } from "./notify";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "./db";
import { invitations, workspaceMembers, workspaces } from "./db/schema";
import { getCurrentUser } from "./session";
import { getActiveWorkspace } from "./workspace";
import { canManageSharing, isPersonalLedger } from "./household-access";

type Result = { ok: true } | { ok: false; error: string };
type InviteResult =
  | { ok: true; member?: { id: string; email: string; name: string; role: string }; invite?: string }
  | { ok: false; error: string };

async function ctx() {
  const ws = await getActiveWorkspace();
  const me = await getCurrentUser();
  if (!ws || !me) return null;
  return { ws, me, isOwner: canManageSharing(ws, me.id) };
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
  // Only a newly granted membership can trigger delivery. An unknown or
  // unverified address stays pending until verification proves who owns it.
  if (isPersonalLedger(c.ws.id)) return {ok:false,error:"Choose a household tracker."};
  const result = await db.execute<{owner:boolean; id:string|null; name:string|null; created:string|null}>(sql`
    WITH owner AS (
      SELECT w.id FROM workspaces w JOIN workspace_members m ON m.workspace_id=w.id AND m.user_id=w.owner_id
      WHERE w.id=${c.ws.id} AND w.owner_id=${c.me.id} AND m.role='owner' FOR SHARE OF w,m
    ), candidate AS (
      SELECT id,name,email_verified_at FROM users WHERE email=${email} FOR SHARE
    ), target AS (
      SELECT id,name FROM candidate WHERE email_verified_at IS NOT NULL
    ), added AS (
      INSERT INTO workspace_members(workspace_id,user_id,role)
      SELECT owner.id,target.id,${role} FROM owner CROSS JOIN target
      ON CONFLICT DO NOTHING RETURNING created_at::text AS created
    ), pending AS (
      INSERT INTO invitations(workspace_id,email,role)
      SELECT id,${email},${role} FROM owner WHERE NOT EXISTS (SELECT 1 FROM target) ON CONFLICT DO NOTHING
    )
    SELECT EXISTS(SELECT 1 FROM owner) AS owner,(SELECT id FROM target) AS id,
      (SELECT name FROM target) AS name,(SELECT created FROM added) AS created`);
  const row = result.rows[0];
  if (!row?.owner) return {ok:false,error:"Only the owner can invite people."};
  if (row.id && !row.created) return {ok:false,error:"They already have access."};
  if (row.id && row.created) await notifyInvitation(c.ws.id,row.id,row.created);
  revalidatePath("/");
  return row.id ? {ok:true,member:{id:row.id,email,name:row.name ?? "",role}} : {ok:true,invite:email};
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
  if (isPersonalLedger(c.ws.id)) return { ok:false, error:"Switch trackers to leave this view. Personal access follows your household membership." };
  if (c.isOwner) return { ok: false, error: "Owners can't leave their own tracker." };
  const db = await getDb();
  await db.delete(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, c.ws.id), eq(workspaceMembers.userId, c.me.id)));
  revalidatePath("/");
  return { ok: true };
}
