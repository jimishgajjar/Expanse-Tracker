import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSplitData } from "@/lib/queries";
import { createSplit } from "@/lib/actions";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ split: await getSplitData() });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const res = await createSplit(await req.json().catch(() => null));
  if (!res.ok) return NextResponse.json({ error: res.error ?? "Couldn't save." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
