import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { deleteGoal } from "@/lib/actions";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const res = await deleteGoal(id);
  if (!res.ok) return NextResponse.json({ error: res.error ?? "Couldn't delete." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
