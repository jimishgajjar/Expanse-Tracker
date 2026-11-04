import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
export { workspacesForUser as userWorkspaces } from "@/lib/workspace";

/** JSON 401 for unauthenticated API requests. */
export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/** Resolve the user from the Bearer session token (via getSession), or null. */
export async function apiUser() {
  return getSession();
}
