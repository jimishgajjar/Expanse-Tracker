import { cache } from "react";
import { asc, eq } from "drizzle-orm";
import { getDb } from "./db";
import { workspaceMembers, workspaces } from "./db/schema";
import { getSession } from "./session";

export type WorkspaceSummary = { id: string; name: string; ownerId: string; role: string };

/** Workspaces the signed-in user can access (their own + shared), memoized per request. */
export const getUserWorkspaces = cache(async (): Promise<WorkspaceSummary[]> => {
  const session = await getSession();
  if (!session) return [];
  const db = await getDb();
  return db
    .select({ id: workspaces.id, name: workspaces.name, ownerId: workspaces.ownerId, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, session.user.id))
    .orderBy(asc(workspaces.createdAt));
});

/** The active workspace id (session's, if still a member; else their first). */
export const getActiveWorkspaceId = cache(async (): Promise<string | null> => {
  const session = await getSession();
  if (!session) return null;
  const memberships = await getUserWorkspaces();
  if (!memberships.length) return null;
  if (session.workspaceId && memberships.some((m) => m.id === session.workspaceId)) return session.workspaceId;
  return memberships[0].id;
});

/** Active workspace + whether the user owns it (for sharing permissions). */
export const getActiveWorkspace = cache(async (): Promise<WorkspaceSummary | null> => {
  const id = await getActiveWorkspaceId();
  if (!id) return null;
  return (await getUserWorkspaces()).find((w) => w.id === id) ?? null;
});
