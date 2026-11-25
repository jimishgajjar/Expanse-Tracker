"use server";

import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "./db";
import { getCurrentUser } from "./session";

// Only display preferences live here; keys are namespaced and small.
const keySchema = z.string().regex(/^overview-layout:[A-Za-z0-9:_-]{1,140}$/);
const valueSchema = z.object({ order: z.array(z.string().max(40)).max(20), hidden: z.array(z.string().max(40)).max(20) });

let present: boolean | null = null;
/** The table arrives with migration 0034; until it is applied, callers fall back to this device. */
async function available() {
  if (present) return true;
  const db = await getDb();
  const res = await db.execute(sql`SELECT to_regclass('public.user_preferences') IS NOT NULL AS ok`);
  present = res.rows[0]?.ok === true;
  return present;
}

export async function loadPreference(key: string): Promise<unknown | null> {
  try {
    const user = await getCurrentUser();
    if (!user || !keySchema.safeParse(key).success || !(await available())) return null;
    const res = await (await getDb()).execute(sql`SELECT value FROM user_preferences WHERE user_id=${user.id} AND key=${key}`);
    return res.rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

export async function savePreference(key: string, value: unknown): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    const parsed = valueSchema.safeParse(value);
    if (!user || !keySchema.safeParse(key).success || !parsed.success || !(await available())) return false;
    await (await getDb()).execute(sql`INSERT INTO user_preferences(user_id, key, value, updated_at)
      VALUES (${user.id}, ${key}, ${JSON.stringify(parsed.data)}::jsonb, now())
      ON CONFLICT (user_id, key) DO UPDATE SET value=excluded.value, updated_at=now()`);
    return true;
  } catch {
    return false;
  }
}
