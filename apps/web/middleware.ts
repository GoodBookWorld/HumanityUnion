/**
 * Pack 2.1 / 2.1A — thin middleware: stamp pathname + URL locale segment for SSR.
 *
 * Intentionally not next-intl routing middleware. No rewrite/redirect.
 * Headers are request-only (not a response contract).
 */

import { NextResponse, type NextRequest } from "next/server";

import { parsePublicSeoLocalePrefixedPath } from "@hu/types";

import {
  HU_PATHNAME_HEADER,
  HU_URL_LOCALE_SEGMENT_HEADER,
} from "./src/features/language/public-seo-locale-headers";

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const pathname = request.nextUrl.pathname;
  requestHeaders.set(HU_PATHNAME_HEADER, pathname);

  const parsed = parsePublicSeoLocalePrefixedPath(pathname);
  if (parsed) {
    requestHeaders.set(HU_URL_LOCALE_SEGMENT_HEADER, parsed.segment);
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

/**
 * Run broadly; candidacy for locale authority is decided by
 * `parsePublicSeoLocalePrefixedPath` in shared resolution. Skips Next/static assets.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/|icons/|.*\\..*).*)"],
};
