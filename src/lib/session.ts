import { randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { sessions, users, type User } from "./db/schema";
import { SESSION_COOKIE } from "./auth-constants";

const DAYS = 30;

export async function createSession(userId: string, workspaceId: string | null) {
  const db = await getDb();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + DAYS * 86_400_000);
  await db.insert(sessions).values({ id: token, userId, workspaceId, expiresAt });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/** Create a session row and return its token, without setting a cookie — for
    native/API clients that store the token themselves and send it as a Bearer. */
export async function createApiSession(userId: string, workspaceId: string | null): Promise<string> {
  const db = await getDb();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + DAYS * 86_400_000);
  await db.insert(sessions).values({ id: token, userId, workspaceId, expiresAt });
  return token;
}

/** Validated session (user + active workspace), memoized per request. */
export const getSession = cache(async (): Promise<{ user: User; workspaceId: string | null } | null> => {
  const jar = await cookies();
  let token = jar.get(SESSION_COOKIE)?.value;
  if (!token) {
    // Mobile / API clients send the session token as `Authorization: Bearer <token>`.
    const auth = (await headers()).get("authorization");
    if (auth?.toLowerCase().startsWith("bearer ")) token = auth.slice(7).trim();
  }
  if (!token) return null;
  const db = await getDb();
  const [row] = await db
    .select({ user: users, workspaceId: sessions.workspaceId, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, token))
    .limit(1);
  if (!row || row.expiresAt.getTime() < Date.now()) return null;
  return { user: row.user, workspaceId: row.workspaceId };
});

export async function getCurrentUser(): Promise<User | null> {
  return (await getSession())?.user ?? null;
}

export async function setActiveWorkspace(workspaceId: string) {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return;
  const db = await getDb();
  await db.update(sessions).set({ workspaceId }).where(eq(sessions.id, token));
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(sessions).where(eq(sessions.id, token));
    jar.delete(SESSION_COOKIE);
  }
}
