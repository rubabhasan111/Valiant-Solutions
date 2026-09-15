import { NextResponse, type NextRequest } from "next/server";

// Must match WORKSHOP_SESSION_COOKIE in lib/auth/session.ts and ADMIN_SESSION_COOKIE in
// lib/admin/session.ts. Proxy shouldn't rely on shared modules, so the names are repeated here.
const WORKSHOP_SESSION_COOKIE = "hs_workshop_session";
const ADMIN_SESSION_COOKIE = "hs_admin_session";

// Optimistic check only: bounce visitors with no session cookie before rendering.
// The real session validation happens in lib/auth/dal.ts and lib/admin/dal.ts on every request.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (pathname === "/admin/login" || request.cookies.has(ADMIN_SESSION_COOKIE)) return NextResponse.next();
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  if (request.cookies.has(WORKSHOP_SESSION_COOKIE)) return NextResponse.next();

  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
