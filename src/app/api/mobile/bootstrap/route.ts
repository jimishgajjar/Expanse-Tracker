import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAccountsWithBalances, getCategories, getTags, getTransactionsInRange } from "@/lib/queries";
import { getRange, RANGE_TYPES, type RangeType } from "@/lib/dates";
import { userWorkspaces } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

/** Everything the dashboard needs in one round-trip, scoped to the Bearer session. */
export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const rangeParam = url.searchParams.get("range") ?? "month";
  const range: RangeType = (RANGE_TYPES as readonly string[]).includes(rangeParam) ? (rangeParam as RangeType) : "month";
  const anchor = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const { start, end } = getRange(range, anchor);

  const [accounts, categories, tags, transactions, wss] = await Promise.all([
    getAccountsWithBalances(),
    getCategories(),
    getTags(),
    getTransactionsInRange(start, end),
    userWorkspaces(s.user.id),
  ]);

  return NextResponse.json({
    user: { id: s.user.id, email: s.user.email, name: s.user.name },
    workspaces: wss,
    activeWorkspaceId: s.workspaceId,
    range: { type: range, anchor, start, end },
    accounts,
    categories,
    tags,
    transactions,
  });
}
