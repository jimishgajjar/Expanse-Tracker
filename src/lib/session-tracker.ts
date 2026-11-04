import { and, eq, exists, inArray, isNull } from "drizzle-orm";
import { getDb } from "./db";
import { sessions, workspaceMembers } from "./db/schema";
import { householdRoles } from "./household-access";

export async function switchSessionTracker(session: { sessionId: string; workspaceId: string | null; user: { id: string } }, target: string) {
  const db = await getDb();
  const member = db.select({ role: workspaceMembers.role }).from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, target), eq(workspaceMembers.userId, session.user.id), inArray(workspaceMembers.role, householdRoles),
  ));
  const [changed] = await db.update(sessions).set({ workspaceId: target }).where(and(
    eq(sessions.id, session.sessionId), eq(sessions.userId, session.user.id), exists(member),
    session.workspaceId === null ? isNull(sessions.workspaceId) : eq(sessions.workspaceId, session.workspaceId),
  )).returning({ id: sessions.workspaceId });
  if (!changed) throw Error("The active tracker or your access changed. Reopen it and try again.");
}
