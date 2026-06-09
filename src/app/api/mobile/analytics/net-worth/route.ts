import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getNetWorthSeries } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ series: await getNetWorthSeries() });
}
