import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSettings } from "@/lib/queries";
import { updateSettings } from "@/lib/actions";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ settings: await getSettings() });
}

export async function PATCH(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const res = await updateSettings(await req.json().catch(() => null));
  if (!res.ok) return NextResponse.json({ error: res.error ?? "Couldn't update." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
