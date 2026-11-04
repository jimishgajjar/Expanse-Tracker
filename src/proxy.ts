import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth-constants";
import { REQUIRED_HEADER, requiresTrackerView, VIEW_HEADER } from "@/lib/tracker-view";

// Note: /api/mobile/* self-authenticates with a Bearer token (and returns JSON
// 401), so it bypasses this cookie-based redirect gate.
const PUBLIC = ["/login", "/signup", "/forgot", "/reset", "/verify", "/api/cron", "/api/mobile", "/manifest.webmanifest", "/sw.js"];

// Optimistic gate: anything without a session cookie is bounced to /login.
// The real session check happens in the page (getCurrentUser).
function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, " + VIEW_HEADER,
    "Access-Control-Max-Age": "86400",
  };
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const forwarded = new Headers(req.headers);
  forwarded.delete(REQUIRED_HEADER);
  const scoped = requiresTrackerView(pathname, req.method);
  if (scoped) forwarded.set(REQUIRED_HEADER, "1");
  const next = () => NextResponse.next({ request: { headers: forwarded } });

  // Mobile API is Bearer-authed JSON (no cookies) — safe to allow cross-origin
  // so the Expo *web* build can reach it; answer CORS preflight directly.
  if (pathname.startsWith("/api/mobile")) {
    if (req.method === "OPTIONS") return new NextResponse(null, { status: 204, headers: corsHeaders() });
    const res = scoped && !req.headers.get(VIEW_HEADER)
      ? NextResponse.json({ error: "Update the app and reopen this tracker." }, { status: 428 })
      : next();
    for (const [k, v] of Object.entries(corsHeaders())) res.headers.set(k, v);
    return res;
  }

  // Root is public: page.tsx renders the marketing landing for logged-out
  // visitors and the dashboard for signed-in users. (Exact match only — a
  // startsWith("/") entry in PUBLIC would expose every route.)
  if (pathname === "/" || pathname === "/help" || pathname === "/api/tracker-view") return next();

  if (PUBLIC.some((p) => pathname.startsWith(p))) return next();
  if (req.cookies.get(SESSION_COOKIE)?.value) return next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  if (pathname !== "/") url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
