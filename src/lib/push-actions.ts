"use server";

import { and, eq } from "drizzle-orm";
import { getDb } from "./db";
import { pushSubscriptions } from "./db/schema";
import { getCurrentUser } from "./session";

type Sub = { endpoint: string; p256dh: string; auth: string };

/** Save (or refresh) this device's push subscription for the signed-in user. */
export async function savePushSubscription(sub: Sub): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || !sub?.endpoint || !sub?.p256dh || !sub?.auth) return { ok: false };
  const db = await getDb();
  await db
    .insert(pushSubscriptions)
    .values({ userId: user.id, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId: user.id, p256dh: sub.p256dh, auth: sub.auth },
    });
  return { ok: true };
}

export async function removePushSubscription(endpoint: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  const db = await getDb();
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, user.id)));
  return { ok: true };
}
