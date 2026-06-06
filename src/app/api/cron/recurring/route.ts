import { NextResponse } from "next/server";
import { processAllRecurring } from "@/lib/queries";
import { checkBudgetAlerts, sendMonthlyDigests } from "@/lib/cron-tasks";

export const dynamic = "force-dynamic";

// Posts any due recurring transactions across every workspace. Scheduled by
// Vercel Cron (see vercel.json). When CRON_SECRET is set, the request must carry
// `Authorization: Bearer <CRON_SECRET>` — Vercel adds this header automatically.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const created = await processAllRecurring().catch(() => 0);
  const digests = await sendMonthlyDigests().catch(() => 0);
  const budgetAlerts = await checkBudgetAlerts().catch(() => 0);
  return NextResponse.json({ ok: true, created, digests, budgetAlerts });
}
