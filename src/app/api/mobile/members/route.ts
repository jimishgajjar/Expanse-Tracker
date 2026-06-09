import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getMembers, getInvites } from "@/lib/queries";
import { inviteMember } from "@/lib/sharing";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [members, invites] = await Promise.all([getMembers(), getInvites()]);
  return NextResponse.json({ members, invites });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const res = await inviteMember(await req.json().catch(() => null));
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
