"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "./db";
import { passwordResets, users } from "./db/schema";
import { hashPassword } from "./password";
import { createSession } from "./session";
import { sendEmail } from "./email";

export async function requestPasswordReset(_prev: string | undefined, formData: FormData): Promise<string> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (email) {
    const db = await getDb();
    const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (u) {
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await db.insert(passwordResets).values({ id: token, userId: u.id, expiresAt });

      const h = await headers();
      const host = h.get("host") ?? "localhost:3000";
      const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
      const base = process.env.APP_URL || `${proto}://${host}`;
      const link = `${base}/reset?token=${token}`;
      await sendEmail(
        email,
        "Reset your Money Tracker password",
        `<p>We received a request to reset your password.</p>
         <p><a href="${link}">Reset your password</a></p>
         <p>Or paste this link into your browser:<br>${link}</p>
         <p>This link expires in 1 hour. If you didn't request it, you can ignore this email.</p>`,
      );
    }
  }
  // Always the same response — don't reveal whether an account exists.
  return "sent";
}

export async function resetPassword(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const token = String(formData.get("token") ?? "");
  const pwP = z.string().min(8, "Password must be at least 8 characters").safeParse(formData.get("password"));
  if (!pwP.success) return pwP.error.issues[0].message;

  const db = await getDb();
  const [row] = await db.select().from(passwordResets).where(eq(passwordResets.id, token)).limit(1);
  if (!row || row.expiresAt.getTime() < Date.now()) return "This reset link is invalid or has expired.";

  await db.update(users).set({ passwordHash: hashPassword(pwP.data) }).where(eq(users.id, row.userId));
  await db.delete(passwordResets).where(eq(passwordResets.id, token));
  await createSession(row.userId); // sign them in
  redirect("/");
}
