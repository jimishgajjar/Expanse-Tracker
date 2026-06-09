import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { sessions, workspaceMembers } from "@/lib/db/schema";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const schema = z.object({ workspaceId: z.string().min(1) });

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const db = await getDb();
  const [member] = await db
    .select({ id: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, p.data.workspaceId), eq(workspaceMembers.userId, s.user.id)))
    .limit(1);
  if (!member) return NextResponse.json({ error: "Not a member of that tracker." }, { status: 403 });

  // Point this Bearer session at the new workspace.
  const auth = (await headers()).get("authorization");
  const token = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
  if (token) await db.update(sessions).set({ workspaceId: p.data.workspaceId }).where(eq(sessions.id, token));
  return NextResponse.json({ ok: true });
}
