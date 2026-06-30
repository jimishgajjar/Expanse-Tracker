import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { deleteTag, renameTag } from "@/lib/actions";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const res = await renameTag(id, await req.json().catch(() => null));
  if (!res.ok) return NextResponse.json({ error: res.error ?? "Couldn't rename." }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const res = await deleteTag(id);
  if (!res.ok) return NextResponse.json({ error: res.error ?? "Couldn't delete." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
