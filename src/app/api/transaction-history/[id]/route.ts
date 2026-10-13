import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { transactionHistory } from "@/lib/db/schema";
import { getActiveWorkspaceId } from "@/lib/workspace";

export async function GET(_request: Request, {params}: {params: Promise<{id:string}>}) {
  const workspace = await getActiveWorkspaceId();
  if (!workspace) return NextResponse.json({error:"Unauthorized"},{status:401});
  const {id} = await params;
  const history = await (await getDb()).select().from(transactionHistory).where(and(eq(transactionHistory.workspaceId,workspace),eq(transactionHistory.transactionId,id))).orderBy(desc(transactionHistory.createdAt)).limit(100);
  return NextResponse.json({history},{headers:{"Cache-Control":"private, no-store"}});
}
