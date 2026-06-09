import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { userWorkspaces } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

/** Current user + workspaces — used to restore a session on app launch. */
export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    user: { id: s.user.id, email: s.user.email, name: s.user.name, emailVerified: !!s.user.emailVerifiedAt },
    workspaces: await userWorkspaces(s.user.id),
    activeWorkspaceId: s.workspaceId,
  });
}
