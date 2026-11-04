import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { backupReports } from "@/lib/db/schema";
import { getDb } from "@/lib/db";
import { getActiveWorkspaceId } from "@/lib/workspace";
export async function GET() {
  const workspace = await getActiveWorkspaceId();
  if (!workspace) return NextResponse.json({error:"Unauthorized"},{status:401});
  // The backup row count describes the entire database, not this household.
  const [report] = await (await getDb()).select({verifiedAt:backupReports.verifiedAt,destination:backupReports.destination})
    .from(backupReports).where(eq(backupReports.workspaceId,workspace));
  return NextResponse.json({report:report ?? null},{headers:{"Cache-Control":"private, no-store"}});
}
