import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { createTransaction } from "@/lib/actions";
import { getTransactionsInRange } from "@/lib/queries";
import { getRange, RANGE_TYPES, type RangeType } from "@/lib/dates";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const rangeParam = url.searchParams.get("range") ?? "month";
  const range: RangeType = (RANGE_TYPES as readonly string[]).includes(rangeParam) ? (rangeParam as RangeType) : "month";
  const anchor = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const { start, end } = getRange(range, anchor);
  return NextResponse.json({ transactions: await getTransactionsInRange(start, end) });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const res = await createTransaction(body);
  if (!res.ok) return NextResponse.json({ error: res.error ?? "Couldn't save." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
