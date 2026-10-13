import { NextResponse } from "next/server";
import { getActiveWorkspaceId } from "@/lib/workspace";
import { getDb } from "@/lib/db";
import { activityFilterSchema, queryActivity } from "@/lib/activity-query";

export async function GET(request: Request) {
  const workspace = await getActiveWorkspaceId();
  if (!workspace) return NextResponse.json({ error: "Sign in to view activity." }, { status: 401 });
  const requested = new URL(request.url).searchParams.get("workspace");
  if (requested && requested !== workspace) return NextResponse.json({error:"Workspace changed. Refresh this page."},{status:409});
  const parsed = activityFilterSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Check your activity filters." }, { status: 400 });
  return NextResponse.json(await queryActivity(await getDb(), workspace, parsed.data), { headers: { "Cache-Control": "private, no-store" } });
}
