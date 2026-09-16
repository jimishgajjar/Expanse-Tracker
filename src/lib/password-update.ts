import { sql } from "drizzle-orm";
import { getDb } from "./db";

/** Update credentials and invalidate other sessions in the same database statement. */
export async function updatePasswordAndSessions(
  userId: string,
  hash: string,
  keepSessionId: string,
) {
  const db = await getDb();
  await db.execute(sql`
    WITH changed AS (
      UPDATE users SET password_hash = ${hash} WHERE id = ${userId} RETURNING id
    ), invalidated AS (
      DELETE FROM password_resets WHERE user_id IN (SELECT id FROM changed)
    )
    DELETE FROM sessions WHERE user_id IN (SELECT id FROM changed) AND id <> ${keepSessionId}
  `);
}

/** Consume a reset link once, change password, revoke sessions and other links atomically. */
export async function consumePasswordReset(
  token: string,
  hash: string,
): Promise<string | null> {
  const db = await getDb();
  const result = await db.execute(sql`
    WITH consumed AS (
      DELETE FROM password_resets WHERE id = ${token} AND expires_at > now() RETURNING user_id
    ), changed AS (
      UPDATE users SET password_hash = ${hash} WHERE id IN (SELECT user_id FROM consumed) RETURNING id
    ), revoked AS (
      DELETE FROM sessions WHERE user_id IN (SELECT id FROM changed)
    ), invalidated AS (
      DELETE FROM password_resets WHERE user_id IN (SELECT id FROM changed) AND id <> ${token}
    )
    SELECT id FROM changed
  `);
  return (result.rows[0]?.id as string | undefined) ?? null;
}
