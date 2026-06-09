import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, workspaces, workspaceMembers } from "@/lib/db/schema";
import { hashPassword } from "@/lib/password";
import { createApiSession } from "@/lib/session";
import { seed } from "@/lib/db/seed";
import { sendVerificationEmail } from "@/lib/verify";
import { rateLimit, clientIp, retryMessage } from "@/lib/rate-limit";
import { userWorkspaces } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().trim().optional().default(""),
});

export async function POST(req: Request) {
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0].message }, { status: 400 });

  const limited = await rateLimit(`signup:${clientIp(await headers())}`, 10, 60 * 60 * 1000);
  if (!limited.ok) return NextResponse.json({ error: retryMessage(limited.retryAfterSec) }, { status: 429 });

  const email = p.data.email.toLowerCase();
  const name = p.data.name ?? "";
  const db = await getDb();
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length) return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });

  const [u] = await db.insert(users).values({ email, name, passwordHash: hashPassword(p.data.password) }).returning();
  const [w] = await db
    .insert(workspaces)
    .values({ name: `${name || email.split("@")[0]}'s tracker`, ownerId: u.id })
    .returning();
  await db.insert(workspaceMembers).values({ workspaceId: w.id, userId: u.id, role: "owner" });
  await seed(db, w.id); // default accounts + categories
  try {
    await sendVerificationEmail(u.id, email, name);
  } catch {
    /* email is best-effort */
  }

  const token = await createApiSession(u.id, w.id);
  return NextResponse.json({
    token,
    user: { id: u.id, email: u.email, name: u.name, emailVerified: false },
    workspaces: await userWorkspaces(u.id),
    activeWorkspaceId: w.id,
  });
}
