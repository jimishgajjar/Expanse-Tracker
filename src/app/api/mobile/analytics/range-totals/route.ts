import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getRangeTotals } from "@/lib/queries";
import { getRange, RANGE_TYPES, type RangeType } from "@/lib/dates";

export const dynamic = "force-dynamic";

/** Income/expense totals for a period — used for period-over-period comparison. */
export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const rangeParam = url.searchParams.get("range") ?? "month";
  const range: RangeType = (RANGE_TYPES as readonly string[]).includes(rangeParam) ? (rangeParam as RangeType) : "month";
  const anchor = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const { start, end } = getRange(range, anchor);
  return NextResponse.json({ totals: await getRangeTotals(start, end) });
}
