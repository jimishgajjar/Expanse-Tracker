import { cache } from "react";
import { and, asc, eq, inArray } from "drizzle-orm";
import { householdRoles } from "./household-access";
import { getDb } from "./db";
import { workspaceMembers, workspaces } from "./db/schema";
import { getSession } from "./session";

export type WorkspaceSummary = { id: string; name: string; ownerId: string; role: string };

/** Workspaces the signed-in user can access (their own + shared), memoized per request. */
export const workspacesForUser = cache(async (userId: string): Promise<WorkspaceSummary[]> => {
  const db = await getDb();
  return db
    .select({ id: workspaces.id, name: workspaces.name, ownerId: workspaces.ownerId, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaceMembers.userId, userId), inArray(workspaceMembers.role, householdRoles)))
    .orderBy(asc(workspaces.createdAt));
});

export const getUserWorkspaces = cache(async () => {
  const session = await getSession();
  return session ? workspacesForUser(session.user.id) : [];
});

/** A removed selection must not silently retarget an open form to another ledger. */
export const getActiveWorkspaceId = cache(async (): Promise<string | null> => {
  const session = await getSession();
  // Deleting a tracker sets sessions.workspace_id to NULL. Never interpret that
  // as permission to redirect a pending write to the user's first membership.
  if (!session?.workspaceId) return null;
  const memberships = await getUserWorkspaces();
  return memberships.some((m) => m.id === session.workspaceId) ? session.workspaceId : null;
});

/** Active workspace + whether the user owns it (for sharing permissions). */
export const getActiveWorkspace = cache(async (): Promise<WorkspaceSummary | null> => {
  const id = await getActiveWorkspaceId();
  if (!id) return null;
  return (await getUserWorkspaces()).find((w) => w.id === id) ?? null;
});

/** The current user's role in the active workspace ("owner" | "member" | "viewer"). */
export const getActiveRole = cache(async (): Promise<string | null> => {
  return (await getActiveWorkspace())?.role ?? null;
});
