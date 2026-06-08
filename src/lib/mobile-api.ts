import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { workspaceMembers, workspaces } from "@/lib/db/schema";

/** JSON 401 for unauthenticated API requests. */
export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/** Resolve the user from the Bearer session token (via getSession), or null. */
export async function apiUser() {
  return getSession();
}

/** Workspaces the user belongs to, with their role. */
export async function userWorkspaces(userId: string) {
  const db = await getDb();
  return db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      role: workspaceMembers.role,
      ownerId: workspaces.ownerId,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, userId));
}
