/**
 * Pack 2.1B — Next 16 proxy: pre-root URL locale authority for SEO public routes.
 *
 * Stamps internal request headers and, for Registry SEO-valid prefixes, overrides
 * the incoming request `hu_lang` cookie for THIS REQUEST ONLY (no Set-Cookie).
 *
 * Fail closed when Registry is unavailable or locale is not SEO-indexable.
 *
 * Location: `src/proxy.ts` (same level as `src/app`) — required for Next 16
 * discovery when App Router lives under `src/app` (Pack 2.1C).
 *
 * EMAIL DELIVERABILITY 03A.1 — POST `/blog/subscribe/unsubscribe` is rewritten
 * to an internal Route Handler (page.tsx and route.ts cannot share a segment).
 * GET passes through unchanged to the existing unsubscribe page.
 */

import { NextResponse, type NextRequest } from "next/server";

import {
  parsePublicSeoLocalePrefixedPath,
  type LanguageRegistryPublicListResponse,
} from "@hu/types";

import { API_BASE_URL } from "./lib/api-base-url";
import {
  HU_PATHNAME_HEADER,
  HU_URL_LOCALE_SEGMENT_HEADER,
} from "./features/language/public-seo-locale-headers";
import {
  decideSeoProxyCookieAuthority,
  rewriteRequestCookieHeaderHuLang,
  type SeoProxyRegistryLocaleRow,
} from "./features/language/public-seo-locale-request";

const BLOG_UNSUBSCRIBE_PATH = "/blog/subscribe/unsubscribe";
const BLOG_UNSUBSCRIBE_INTERNAL_PATH = "/api/internal/blog-subscribe-unsubscribe";

/**
 * Public languages list only includes enabled locales (membership ⇒ enabled).
 * Map explicitly so authority uses Registry `enabled` + `seoIndexingEnabled`
 * via shared `isSeoIndexableLanguage` (never hardcode enabled inside the gate).
 */
async function fetchSeoProxyRegistryCatalog(): Promise<
  readonly SeoProxyRegistryLocaleRow[] | null
> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/languages`, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(2_000),
    });
    if (!response.ok) {
      return null;
    }
    const envelope = (await response.json()) as {
      success?: boolean;
      data?: LanguageRegistryPublicListResponse;
    };
    const languages = envelope.data?.languages;
    if (!Array.isArray(languages) || languages.length === 0) {
      return null;
    }

    return languages.map((row) => ({
      locale: row.locale,
      aliases: [...row.aliases],
      // Public projection omits `enabled`; list membership means enabled=true.
      enabled: true,
      seoIndexingEnabled: row.seoIndexingEnabled === true,
    }));
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // RFC 8058 one-click: same public URI as human GET page; POST → internal handler.
  if (pathname === BLOG_UNSUBSCRIBE_PATH && request.method === "POST") {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = BLOG_UNSUBSCRIBE_INTERNAL_PATH;
    return NextResponse.rewrite(rewriteUrl);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(HU_PATHNAME_HEADER, pathname);

  const parsed = parsePublicSeoLocalePrefixedPath(pathname);

  if (parsed) {
    requestHeaders.set(HU_URL_LOCALE_SEGMENT_HEADER, parsed.segment);

    const catalog = await fetchSeoProxyRegistryCatalog();
    const decision = decideSeoProxyCookieAuthority({
      urlLocaleSegment: parsed.segment,
      catalog,
    });

    if (decision.applyOverride) {
      requestHeaders.set(
        "cookie",
        rewriteRequestCookieHeaderHuLang(
          request.headers.get("cookie"),
          decision.locale,
        ),
      );
    }
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

/**
 * Preserve Pack 2.1 matcher semantics. Locale candidacy is decided by
 * `parsePublicSeoLocalePrefixedPath` + Registry SEO gate.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/|icons/|.*\\..*).*)"],
};
