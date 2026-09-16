import { NextResponse } from "next/server";
import { processAllRecurring } from "@/lib/queries";
import { checkBudgetAlerts, sendMonthlyDigests } from "@/lib/cron-tasks";

export const dynamic = "force-dynamic";

// Posts any due recurring transactions across every workspace. Scheduled by
// Vercel Cron (see vercel.json). When CRON_SECRET is set, the request must carry
// `Authorization: Bearer <CRON_SECRET>` — Vercel adds this header automatically.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (process.env.NODE_ENV === "production" && !secret) return new NextResponse("Cron is not configured", { status: 503 });
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  try {
    const created = await processAllRecurring();
    const digests = await sendMonthlyDigests();
    const budgetAlerts = await checkBudgetAlerts();
    return NextResponse.json({ ok: true, created, digests, budgetAlerts });
  } catch (error) {
    console.error("Scheduled financial processing failed", error);
    return NextResponse.json({ ok: false, error: "Scheduled processing failed. Retry the job." }, { status: 500 });
  }
}
