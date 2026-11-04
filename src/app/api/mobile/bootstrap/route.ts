import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAccountsWithBalances, getCategories, getTags, getTransactionsInRange, getTransfersInRange, getSettings, getRangeTotals } from "@/lib/queries";
import { getRange, RANGE_TYPES, type RangeType } from "@/lib/dates";
import { userWorkspaces } from "@/lib/mobile-api";
import { getActiveWorkspaceId } from "@/lib/workspace";
import { financeDatabase } from "@/lib/finance-release";
import { financeReport } from "@/lib/finance-position";
import { recordedBalance, type MobilePosition, type LedgerTotals } from "@/lib/mobile-contract";

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

  const workspace = await getActiveWorkspaceId();
  const [accounts, categories, tags, transactions, transfers, settings, wss, totals, finance] = await Promise.all([
    getAccountsWithBalances(),
    getCategories(),
    getTags(),
    getTransactionsInRange(start, end),
    getTransfersInRange(start, end),
    getSettings(),
    userWorkspaces(s.user.id),
    getRangeTotals(start,end),
    (async ():Promise<MobilePosition|null> => {
      if (!workspace) return null;
      const db = await financeDatabase();
      if (!db) return null;
      const {report,position,flows}=await financeReport(db,{workspace,actor:s.user.id});
      return {report,position,flows};
    })(),
  ]);

  const summary:LedgerTotals={...totals,net:Math.round((totals.income-totals.expense)*100)/100,balance:recordedBalance(accounts)};
  return NextResponse.json({
    user: { id: s.user.id, email: s.user.email, name: s.user.name },
    workspaces: wss,
    activeWorkspaceId: workspace, finance, summary,
    settings,
    range: { type: range, anchor, start, end },
    accounts,
    categories,
    tags,
    transactions,
    transfers,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
