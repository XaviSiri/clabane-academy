import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";

/**
 * Edge-level defense in depth: redirects unauthenticated/unauthorized
 * requests away from protected sections before they reach a page. This is
 * a UX shortcut, not the authorization boundary — every Server Component
 * and Route Handler underneath still calls requireAdmin/requireEmployee/
 * getAuthorizedSession itself.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  const isAdminRoute = pathname.startsWith("/admin");
  const isEmployeeRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/modules") ||
    pathname.startsWith("/lessons") ||
    pathname.startsWith("/assessments") ||
    pathname.startsWith("/certificate") ||
    pathname.startsWith("/account");

  if ((isAdminRoute || isEmployeeRoute) && !session) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminRoute && session && session.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }

  if (isEmployeeRoute && session && session.role !== "EMPLOYEE") {
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/dashboard/:path*",
    "/modules/:path*",
    "/lessons/:path*",
    "/assessments/:path*",
    "/certificate/:path*",
    "/account/:path*",
  ],
};
