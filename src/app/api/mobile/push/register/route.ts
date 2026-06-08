import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const schema = z.object({ token: z.string().min(1), platform: z.string().optional() });

/** Store an Expo push token. Reuses the web-push table: the token goes in
    `endpoint`, and the platform marker in `auth` lets the sender route native
    tokens to the Expo push service instead of web-push. */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Invalid push token." }, { status: 400 });

  const db = await getDb();
  const [existing] = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, p.data.token))
    .limit(1);

  if (existing) {
    await db.update(pushSubscriptions).set({ userId: s.user.id }).where(eq(pushSubscriptions.id, existing.id));
  } else {
    await db.insert(pushSubscriptions).values({
      userId: s.user.id,
      endpoint: p.data.token,
      p256dh: "expo",
      auth: p.data.platform ?? "expo",
    });
  }
  return NextResponse.json({ ok: true });
}
