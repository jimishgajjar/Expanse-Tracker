import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth-constants";

// Note: /api/mobile/* self-authenticates with a Bearer token (and returns JSON
// 401), so it bypasses this cookie-based redirect gate.
const PUBLIC = ["/login", "/signup", "/forgot", "/reset", "/verify", "/api/cron", "/api/mobile", "/manifest.webmanifest", "/sw.js"];

// Optimistic gate: anything without a session cookie is bounced to /login.
// The real session check happens in the page (getCurrentUser).
function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Mobile API is Bearer-authed JSON (no cookies) — safe to allow cross-origin
  // so the Expo *web* build can reach it; answer CORS preflight directly.
  if (pathname.startsWith("/api/mobile")) {
    if (req.method === "OPTIONS") return new NextResponse(null, { status: 204, headers: corsHeaders() });
    const res = NextResponse.next();
    for (const [k, v] of Object.entries(corsHeaders())) res.headers.set(k, v);
    return res;
  }

  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (req.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  if (pathname !== "/") url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
