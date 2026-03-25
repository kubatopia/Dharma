import { auth } from "./lib/auth";
import { NextResponse } from "next/server";

/**
 * middleware.ts — route protection.
 *
 * Runs on every request that matches `config.matcher`.
 * If the user has no session, redirect them to /login.
 *
 * Public routes (no auth needed):
 *   /login         — the sign-in page itself
 *   /api/auth/**   — NextAuth's own endpoints
 *
 * Everything else requires a signed-in session.
 *
 * We use NextAuth's `auth` export directly as middleware —
 * it reads the session cookie and populates req.auth automatically.
 */
export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/api/auth/");

  if (!isLoggedIn && !isPublic) {
    const loginUrl = new URL("/login", req.url);
    // Preserve the intended destination so we can redirect back after sign-in
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  // Run middleware on all routes except Next.js internals and static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
