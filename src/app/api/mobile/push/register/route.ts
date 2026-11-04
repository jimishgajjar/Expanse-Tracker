import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const schema = z.object({ token: z.string().max(512).regex(/^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]+\]$/), platform: z.enum(["ios","android"]).optional() });

/** Store an Expo push token. Reuses the web-push table: the token goes in
    `endpoint`, and the platform marker in `auth` lets the sender route native
    tokens to the Expo push service instead of web-push. */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Invalid push token." }, { status: 400 });

  const db = await getDb();
  const device = {userId:s.user.id,p256dh:"expo",auth:p.data.platform ?? "expo"};
  await db.insert(pushSubscriptions).values({...device,endpoint:p.data.token})
    .onConflictDoUpdate({target:pushSubscriptions.endpoint,set:device});
  return NextResponse.json({ ok: true });
}
