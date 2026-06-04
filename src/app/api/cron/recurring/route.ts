import { NextResponse } from "next/server";
import { processAllRecurring } from "@/lib/queries";

export const dynamic = "force-dynamic";

// Posts any due recurring transactions across every workspace. Scheduled by
// Vercel Cron (see vercel.json). When CRON_SECRET is set, the request must carry
// `Authorization: Bearer <CRON_SECRET>` — Vercel adds this header automatically.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const created = await processAllRecurring();
  return NextResponse.json({ ok: true, created });
}
