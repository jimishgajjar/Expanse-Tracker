"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "./db";
import { passwordResets, users, workspaceMembers, workspaces } from "./db/schema";
import { hashPassword } from "./password";
import { createSession } from "./session";
import { sendEmail } from "./email";
import { renderEmail } from "./email-template";
import { rateLimit } from "./rate-limit";
import { requestBaseUrl } from "./base-url";

export async function requestPasswordReset(_prev: string | undefined, formData: FormData): Promise<string> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (email) {
    const limited = await rateLimit(`reset:${email}`, 5, 15 * 60 * 1000);
    if (!limited.ok) return "sent"; // silently throttle without revealing anything
    const db = await getDb();
    const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (u) {
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await db.insert(passwordResets).values({ id: token, userId: u.id, expiresAt });

      const base = await requestBaseUrl();
      const link = `${base}/reset?token=${token}`;
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
  }
  // Always the same response — don't reveal whether an account exists.
  return "sent";
}

export async function resetPassword(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const token = String(formData.get("token") ?? "");
  const pwP = z.string().min(8, "Password must be at least 8 characters").safeParse(formData.get("password"));
  if (!pwP.success) return pwP.error.issues[0].message;
  if (pwP.data !== String(formData.get("confirm") ?? "")) return "Passwords don't match.";

  const db = await getDb();
  const [row] = await db.select().from(passwordResets).where(eq(passwordResets.id, token)).limit(1);
  if (!row || row.expiresAt.getTime() < Date.now()) return "This reset link is invalid or has expired.";

  await db.update(users).set({ passwordHash: hashPassword(pwP.data) }).where(eq(users.id, row.userId));
  await db.delete(passwordResets).where(eq(passwordResets.id, token));

  const [owned] = await db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.ownerId, row.userId)).limit(1);
  let wid = owned?.id ?? null;
  if (!wid) {
    const [m] = await db.select({ id: workspaceMembers.workspaceId }).from(workspaceMembers).where(eq(workspaceMembers.userId, row.userId)).limit(1);
    wid = m?.id ?? null;
  }
  await createSession(row.userId, wid); // sign them in
  redirect("/");
}
