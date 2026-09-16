import { NextResponse } from "next/server";
import { z } from "zod";
import { updatePasswordAndSessions } from "@/lib/password-update";
import { getSession } from "@/lib/session";
import { verifyPassword, hashPassword } from "@/lib/password";

export const dynamic = "force-dynamic";

const schema = z.object({
  current: z.string().min(1),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0].message }, { status: 400 });
  if (!verifyPassword(p.data.current, s.user.passwordHash)) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
  }
  await updatePasswordAndSessions(s.user.id, hashPassword(p.data.newPassword), s.sessionId);
  return NextResponse.json({ ok: true });
}
