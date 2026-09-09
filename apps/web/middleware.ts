/**
 * Pack 2.1 — thin middleware: stamp URL locale segment for SEO public prefixes.
 *
 * Intentionally not next-intl routing middleware. No rewrite/redirect.
 * Locale-free URLs are untouched.
 */

import { NextResponse, type NextRequest } from "next/server";

import { parsePublicSeoLocalePrefixedPath } from "@hu/types";

import { HU_URL_LOCALE_SEGMENT_HEADER } from "./src/features/language/public-seo-locale-headers";

export function middleware(request: NextRequest) {
  const parsed = parsePublicSeoLocalePrefixedPath(request.nextUrl.pathname);
  if (!parsed) {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(HU_URL_LOCALE_SEGMENT_HEADER, parsed.segment);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

/**
 * Run broadly; candidacy is decided by `parsePublicSeoLocalePrefixedPath`
 * (reserved top segments + SEO perimeter). Skips Next/static asset paths.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/|icons/|.*\\..*).*)"],
};
