import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { resendVerification } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const res = await resendVerification();
  if (!res.ok) return NextResponse.json({ error: res.error ?? "Couldn't send." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
