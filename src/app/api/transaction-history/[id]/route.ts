import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { readHouseholdHistory } from "@/lib/household-history";
import { getActiveWorkspaceId } from "@/lib/workspace";

export async function GET(_request: Request, {params}: {params: Promise<{id:string}>}) {
  const [workspace, reader, {id}] = await Promise.all([getActiveWorkspaceId(), getCurrentUser(), params]);
  const headers = {"Cache-Control":"private, no-store"};
  if (!reader) return NextResponse.json({error:"Unauthorized"}, {status:401, headers});
  const result = workspace && await readHouseholdHistory(await getDb(), workspace, reader.id, id);
  return result ? NextResponse.json(result, {headers}) : NextResponse.json({error:"Transaction unavailable."}, {status:404, headers});
}
