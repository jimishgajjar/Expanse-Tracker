import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { householdRoles } from "@/lib/household-access";
import { getDb } from "@/lib/db";
import { workspaceMembers } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { switchSessionTracker } from "@/lib/session-tracker";

export const dynamic = "force-dynamic";

const schema = z.object({ workspaceId: z.string().min(1) });

export async function POST(req: Request) {
  const s = await getSession();
  const bearer = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") ?? "")?.[1];
  if (!s || !bearer || bearer !== s.sessionId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const db = await getDb();
  const [member] = await db
    .select({ id: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, p.data.workspaceId), eq(workspaceMembers.userId, s.user.id), inArray(workspaceMembers.role, householdRoles)))
    .limit(1);
  if (!member) return NextResponse.json({ error: "Not a member of that tracker." }, { status: 403 });

  try { await switchSessionTracker(s, p.data.workspaceId); }
  catch { return NextResponse.json({error:"The tracker changed. Check access and try again."}, {status:409}); }
  return NextResponse.json({ ok: true });
}
