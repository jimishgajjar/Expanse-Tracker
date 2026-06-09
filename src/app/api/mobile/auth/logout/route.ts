import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { sessions } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/** Invalidate the current session token (sent as Bearer). */
export async function POST() {
  const auth = (await headers()).get("authorization");
  const token = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
  if (token) {
    const db = await getDb();
    await db.delete(sessions).where(eq(sessions.id, token));
  }
  return NextResponse.json({ ok: true });
}
