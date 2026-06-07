import { headers } from "next/headers";

/**
 * Base URL for links inside emails sent from a request context — password
 * reset, email verification, sharing invites.
 *
 * Prefers the host the request actually arrived on (i.e. the domain the user is
 * on right now), so links never point at a stale APP_URL after a domain rename.
 * This is safe on Vercel: only domains attached to the project are routed to the
 * app, so the Host header can't be spoofed to an external site. Falls back to
 * APP_URL, then localhost, when there is no request host (e.g. cron).
 */
export async function requestBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("host");
  if (host) {
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return process.env.APP_URL || "http://localhost:3000";
}
