import { createHash } from "node:crypto";

// Server-only auth helpers shared by the proxy and the login action.
export const AUTH_COOKIE = "mt_auth";

export function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** The expected cookie value, or null when no APP_PASSWORD is set (auth off). */
export function authToken(): string | null {
  const pw = process.env.APP_PASSWORD;
  return pw ? hash(pw) : null;
}

export const isAuthEnabled = () => !!process.env.APP_PASSWORD;
