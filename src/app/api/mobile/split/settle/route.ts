import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { settleUp } from "@/lib/actions";

export const dynamic = "force-dynamic";

const schema = z.object({ otherUserId: z.string().min(1) });

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const res = await settleUp(p.data.otherUserId);
  if (!res.ok) return NextResponse.json({ error: res.error ?? "Couldn't settle." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
