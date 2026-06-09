import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { passwordResets, users } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-template";
import { rateLimit } from "@/lib/rate-limit";
import { requestBaseUrl } from "@/lib/base-url";

export const dynamic = "force-dynamic";

const schema = z.object({ email: z.string().trim().email() });

/** Mobile password-reset request. The emailed link opens the web /reset page
    (mobile has no deep link), so the app only needs to trigger the email. Always
    returns ok so we never reveal whether an account exists. */
export async function POST(req: Request) {
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ ok: true });

  const email = p.data.email.toLowerCase();
  const limited = await rateLimit(`reset:${email}`, 5, 15 * 60 * 1000);
  if (!limited.ok) return NextResponse.json({ ok: true });

  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (u) {
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await db.insert(passwordResets).values({ id: token, userId: u.id, expiresAt });
    const link = `${await requestBaseUrl()}/reset?token=${token}`;
    await sendEmail(
      email,
      "Reset your Expense Tracker password",
      renderEmail({
        heading: "Reset your password",
        intro: "We received a request to reset your Expense Tracker password. Choose a new one with the button below.",
        cta: { label: "Reset password", url: link },
        footnote: "This link expires in 1 hour. If you didn't request it, you can safely ignore this email.",
      }),
    );
  }
  return NextResponse.json({ ok: true });
}
