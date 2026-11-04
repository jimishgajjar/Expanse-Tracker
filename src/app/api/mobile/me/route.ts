import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { userWorkspaces } from "@/lib/mobile-api";
import { getActiveWorkspaceId } from "@/lib/workspace";

export const dynamic = "force-dynamic";

/** Current user + workspaces — used to restore a session on app launch. */
export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const headers = { "Cache-Control": "private, no-store" };
  if (new URL(req.url).searchParams.get("check") === "1") {
    return NextResponse.json({ viewKey: s.viewKey }, { headers });
  }
  return NextResponse.json({
    user: { id: s.user.id, email: s.user.email, name: s.user.name, emailVerified: !!s.user.emailVerifiedAt },
    workspaces: await userWorkspaces(s.user.id),
    viewKey: s.viewKey,
    expiresAt: s.expiresAt.toISOString(),
    activeWorkspaceId: await getActiveWorkspaceId(),
  }, { headers });
}
