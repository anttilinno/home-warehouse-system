import { NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { locales } from './i18n';

const handleRequest = createMiddleware({
  // A list of all locales that are supported
  locales: locales,

  // Used when no locale matches
  defaultLocale: 'en',

  // Always use locale prefix for consistency
  localePrefix: 'always'
});

export function proxy(request: NextRequest) {
  return handleRequest(request);
}

export const config = {
  // Match only internationalized pathnames
  matcher: ['/', '/(en|et|ru)/:path*']
};
