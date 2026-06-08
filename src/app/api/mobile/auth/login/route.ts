import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/password";
import { createApiSession } from "@/lib/session";
import { userWorkspaces } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const schema = z.object({ email: z.string().trim().email(), password: z.string().min(1) });

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const p = schema.safeParse(body);
  if (!p.success) return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });

  const email = p.data.email.toLowerCase();
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!u || !verifyPassword(p.data.password, u.passwordHash)) {
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }

  const wss = await userWorkspaces(u.id);
  const active = wss.find((w) => w.ownerId === u.id) ?? wss[0];
  const token = await createApiSession(u.id, active?.id ?? null);

  return NextResponse.json({
    token,
    user: { id: u.id, email: u.email, name: u.name, emailVerified: !!u.emailVerifiedAt },
    workspaces: wss,
    activeWorkspaceId: active?.id ?? null,
  });
}
