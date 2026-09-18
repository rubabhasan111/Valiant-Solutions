import { NextResponse, type NextRequest } from "next/server";

// Must match WORKSHOP_SESSION_COOKIE in lib/auth/session.ts, ADMIN_SESSION_COOKIE in
// lib/admin/session.ts and CUSTOMER_SESSION_COOKIE in lib/customer/session.ts. Proxy
// shouldn't rely on shared modules, so the names are repeated here.
const WORKSHOP_SESSION_COOKIE = "hs_workshop_session";
const ADMIN_SESSION_COOKIE = "hs_admin_session";
const CUSTOMER_SESSION_COOKIE = "hs_customer_session";

// Optimistic check only: bounce visitors with no session cookie before rendering. The real
// session validation happens in the data layers (lib/auth/dal.ts, lib/admin/dal.ts,
// lib/customer/session.ts) on every request.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    // The setup page guards itself: it needs the setup key and closes once an admin exists.
    const openToEveryone = pathname === "/admin/login" || pathname === "/admin/setup";
    if (openToEveryone || request.cookies.has(ADMIN_SESSION_COOKIE)) return NextResponse.next();
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  if (pathname === "/account" || pathname.startsWith("/account/")) {
    const signingIn = pathname === "/account/login" || pathname === "/account/verify";
    if (signingIn || request.cookies.has(CUSTOMER_SESSION_COOKIE)) return NextResponse.next();
    return NextResponse.redirect(new URL("/account/login", request.url));
  }

  if (request.cookies.has(WORKSHOP_SESSION_COOKIE)) return NextResponse.next();

  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/account/:path*"],
};
