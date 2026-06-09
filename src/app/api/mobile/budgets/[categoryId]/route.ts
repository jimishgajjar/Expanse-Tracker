import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { deleteBudget } from "@/lib/actions";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: Promise<{ categoryId: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { categoryId } = await params;
  const res = await deleteBudget(categoryId);
  if (!res.ok) return NextResponse.json({ error: res.error ?? "Couldn't delete." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
