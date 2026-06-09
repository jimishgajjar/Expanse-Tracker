import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { setAccountArchived } from "@/lib/actions";

export const dynamic = "force-dynamic";

const schema = z.object({ archived: z.boolean() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const res = await setAccountArchived(id, p.data.archived);
  if (!res.ok) return NextResponse.json({ error: res.error ?? "Couldn't update." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
