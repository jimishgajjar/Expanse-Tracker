import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { quickEntries } from "@/lib/quick-entries";

export const dynamic = "force-dynamic";

/** Repeat entries for one-tap quick add on the phone. Read-only; editors only. */
export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ entries: await quickEntries() }, { headers: { "Cache-Control": "private, no-store" } });
}
