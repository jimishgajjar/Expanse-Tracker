import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { switchSessionTracker } from "./session-tracker";
import { getDb } from "./db";
import { sessions, users, workspaceMembers, type User } from "./db/schema";
import { REQUIRED_HEADER, VIEW_HEADER } from "./tracker-view";
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
export const getSession = cache(async (): Promise<{ user: User; workspaceId: string | null; sessionId: string; viewKey: string; expiresAt: Date } | null> => {
  const jar = await cookies();
  const request = await headers();
  const bearer = /^Bearer\s+(\S+)$/i.exec(request.get("authorization") ?? "");
  const token = bearer ? bearer[1] : jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const [row] = await db
    .select({ user: users, workspaceId: sessions.workspaceId, expiresAt: sessions.expiresAt, role: workspaceMembers.role })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .leftJoin(workspaceMembers, and(eq(workspaceMembers.userId, sessions.userId), eq(workspaceMembers.workspaceId, sessions.workspaceId)))
    .where(eq(sessions.id, token))
    .limit(1);
  if (!row || row.expiresAt.getTime() < Date.now()) return null;
  const viewKey = createHash("sha256").update(JSON.stringify(["view-v1", token, row.workspaceId, row.role])).digest("hex");
  const expected = request.get(VIEW_HEADER);
  if ((expected !== null || request.has(REQUIRED_HEADER)) && expected !== viewKey) return null;
  return { user: row.user, workspaceId: row.workspaceId, sessionId: token, viewKey, expiresAt:row.expiresAt };
});

export async function getCurrentUser(): Promise<User | null> {
  return (await getSession())?.user ?? null;
}

export async function setActiveWorkspace(workspaceId: string) {
  const session = await getSession();
  if (!session) throw Error("Reopen the tracker before switching.");
  await switchSessionTracker(session, workspaceId);
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token && (await getSession())?.sessionId === token) {
    const db = await getDb();
    await db.delete(sessions).where(eq(sessions.id, token));
    jar.delete(SESSION_COOKIE);
  }
}
