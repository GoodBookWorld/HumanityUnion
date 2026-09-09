/**
 * Pack 2.1B — Next 16 proxy: pre-root URL locale authority for SEO public routes.
 *
 * Stamps internal request headers and, for Registry SEO-valid prefixes, overrides
 * the incoming request `hu_lang` cookie for THIS REQUEST ONLY (no Set-Cookie).
 *
 * Temporary response diagnostic: `x-hu-seo-locale` when SEO-valid.
 * Fail closed when Registry is unavailable or locale is not SEO-indexable.
 */

import { NextResponse, type NextRequest } from "next/server";

import {
  parsePublicSeoLocalePrefixedPath,
  type LanguageRegistryPublicListResponse,
} from "@hu/types";

import { API_BASE_URL } from "./src/lib/api-base-url";
import {
  HU_PATHNAME_HEADER,
  HU_SEO_LOCALE_DIAGNOSTIC_HEADER,
  HU_URL_LOCALE_SEGMENT_HEADER,
} from "./src/features/language/public-seo-locale-headers";
import {
  decideSeoProxyCookieAuthority,
  rewriteRequestCookieHeaderHuLang,
  type SeoProxyRegistryLocaleRow,
} from "./src/features/language/public-seo-locale-request";

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
  const requestHeaders = new Headers(request.headers);
  const pathname = request.nextUrl.pathname;
  requestHeaders.set(HU_PATHNAME_HEADER, pathname);

  const parsed = parsePublicSeoLocalePrefixedPath(pathname);
  let diagnosticLocale: string | null = null;

  if (parsed) {
    requestHeaders.set(HU_URL_LOCALE_SEGMENT_HEADER, parsed.segment);

    const catalog = await fetchSeoProxyRegistryCatalog();
    const decision = decideSeoProxyCookieAuthority({
      urlLocaleSegment: parsed.segment,
      catalog,
    });

    if (decision.applyOverride) {
      diagnosticLocale = decision.locale;
      requestHeaders.set(
        "cookie",
        rewriteRequestCookieHeaderHuLang(
          request.headers.get("cookie"),
          decision.locale,
        ),
      );
    }
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  if (diagnosticLocale) {
    response.headers.set(HU_SEO_LOCALE_DIAGNOSTIC_HEADER, diagnosticLocale);
  }

  return response;
}

/**
 * Preserve Pack 2.1 matcher semantics. Locale candidacy is decided by
 * `parsePublicSeoLocalePrefixedPath` + Registry SEO gate.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/|icons/|.*\\..*).*)"],
};
