import { NextResponse } from "next/server";
import { getActiveWorkspaceId } from "@/lib/workspace";
import { getGoals, getSplitData, getMembers, getInvites, getNetWorthSeries, getTransactionsInRange } from "@/lib/queries";
import { getAnalytics } from "@/lib/analytics";
import { getRange, RANGE_TYPES, shiftAnchor, todayISO, type RangeType } from "@/lib/dates";

export async function GET(request: Request) {
  const workspace = await getActiveWorkspaceId();
  if (!workspace) return NextResponse.json({error:"Unauthorized"},{status:401});
  const p = new URL(request.url).searchParams;
  if (p.get("workspace") && p.get("workspace") !== workspace) return NextResponse.json({error:"Workspace changed"},{status:409});
  const headers = {"Cache-Control":"private, no-store"};
  if (p.get("section") === "tools") {
    const [goals,split,members,invites] = await Promise.all([getGoals(),getSplitData(),getMembers(),getInvites()]);
    return NextResponse.json({goals,split,members,invites},{headers});
  }
  if (p.get("section") !== "analytics") return NextResponse.json({error:"Unknown section"},{status:400});
  const rangeType = p.get("range") as RangeType;
  const anchor = p.get("date") ?? todayISO();
  if (!RANGE_TYPES.includes(rangeType) || !/^\d{4}-\d{2}-\d{2}$/.test(anchor) || Number.isNaN(Date.parse(anchor))) return NextResponse.json({error:"Invalid period"},{status:400});
  const range = getRange(rangeType,anchor);
  const prev = rangeType === "all" ? null : getRange(rangeType,shiftAnchor(rangeType,anchor,-1));
  const [analytics,netWorth,transactions] = await Promise.all([getAnalytics(range,prev),getNetWorthSeries(),getTransactionsInRange(range.start,range.end)]);
  return NextResponse.json({analytics,netWorth,transactions},{headers});
}
