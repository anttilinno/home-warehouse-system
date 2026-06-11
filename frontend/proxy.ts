import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

/** Matches /dashboard/* with or without a locale prefix (e.g. /en/dashboard). */
const DASHBOARD_PATH = new RegExp(
  `^/(?:(${routing.locales.join("|")})/)?dashboard(?:/|$)`
);

export default function proxy(request: NextRequest) {
  // Run next-intl first so locale negotiation/redirects always happen.
  const response = intlMiddleware(request);

  // Server-side auth gate for dashboard routes: without the access_token
  // cookie there is no session, so redirect to login before shipping the
  // app shell (the client-side check in DashboardShell remains as UX
  // fallback for expired-but-present cookies).
  const { pathname } = request.nextUrl;
  const match = pathname.match(DASHBOARD_PATH);
  if (match && !request.cookies.has("access_token")) {
    const locale = match[1];
    const loginUrl = new URL(locale ? `/${locale}/login` : "/login", request.url);
    loginUrl.searchParams.set("returnTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // Match all pathnames except for
    // - API routes
    // - _next (Next.js internals)
    // - Static files (images, fonts, etc.)
    "/((?!api|_next|.*\\..*).*)",
  ],
};
