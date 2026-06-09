import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { contributeGoal } from "@/lib/actions";

export const dynamic = "force-dynamic";

const schema = z.object({ amount: z.coerce.number() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Invalid amount." }, { status: 400 });
  const res = await contributeGoal(id, p.data.amount);
  if (!res.ok) return NextResponse.json({ error: res.error ?? "Couldn't contribute." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
