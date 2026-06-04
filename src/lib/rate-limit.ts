import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { rateLimits } from "./db/schema";

export type RateResult = { ok: true } | { ok: false; retryAfterSec: number };

/**
 * Fixed-window rate limiter backed by a single upserted row per key. Atomic in
 * one statement, so it works on serverless (Neon HTTP) without transactions.
 * Returns ok:false once more than `limit` hits land inside `windowMs`.
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateResult> {
  const db = await getDb();
  const now = new Date();
  const expires = new Date(now.getTime() + windowMs);
  const [row] = await db
    .insert(rateLimits)
    .values({ key, count: 1, expiresAt: expires })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        // Reset the window if it has elapsed, otherwise increment.
        count: sql`case when ${rateLimits.expiresAt} < ${now} then 1 else ${rateLimits.count} + 1 end`,
        expiresAt: sql`case when ${rateLimits.expiresAt} < ${now} then ${expires} else ${rateLimits.expiresAt} end`,
      },
    })
    .returning({ count: rateLimits.count, expiresAt: rateLimits.expiresAt });

  if (row.count > limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((row.expiresAt.getTime() - now.getTime()) / 1000)) };
  }
  return { ok: true };
}

/** Best-effort client IP from proxy headers (for per-IP limits). */
export function clientIp(h: { get(name: string): string | null }): string {
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

export function retryMessage(sec: number): string {
  const m = Math.ceil(sec / 60);
  return `Too many attempts. Please try again in ${m > 1 ? `${m} minutes` : "a minute"}.`;
}
