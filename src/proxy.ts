import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, authToken } from "@/lib/auth-token";

// Next.js 16 "Proxy" (formerly Middleware). Gates the whole app behind
// APP_PASSWORD when set; a no-op when it isn't.
export function proxy(req: NextRequest) {
  const token = authToken();
  if (!token) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/login")) return NextResponse.next();
  if (req.cookies.get(AUTH_COOKIE)?.value === token) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
