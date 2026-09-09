/**
 * Production Completion Pack 02C Task 02 — server document locale resolution.
 * Pack 2.1 — URL locale segment (SEO-prefixed public paths) wins over cookie.
 *
 * Uses the shared `@hu/types` catalog resolver (same precedence as API).
 * Does not use legacy base-tag collapse helpers for html lang/dir.
 *
 * Authenticated Participant interfaceLanguage is applied on API requests via
 * `runtimeLocaleMiddleware`. Web SSR cannot read API host-only auth cookies,
 * so HTML uses cookie + Accept-Language against the enabled public catalog
 * unless a validated SEO URL locale is present.
 *
 * Pack 02C Hotfix 01 — server-only (imports next/headers). Import only from
 * server entrypoints such as `app/layout.tsx`. Never re-export from client/shared
 * barrels (e.g. `features/language/index.ts`).
 */

import {
  ENGLISH_RUNTIME_LOCALE_FALLBACK,
  HU_LANG_COOKIE_NAME,
  resolvePublicSeoLocaleDocument,
  type LanguageRegistryPublicListResponse,
  type PublicSeoLocaleDocumentResolution,
  type PublicSeoLocaleRoutingCatalogEntry,
  type ResolvedRuntimeLocale,
  type RuntimeLocaleCatalogEntry,
} from "@hu/types";
import { cookies, headers } from "next/headers";
import { cache } from "react";

import { API_BASE_URL } from "../../lib/api-base-url";
import { HU_URL_LOCALE_SEGMENT_HEADER } from "./public-seo-locale-headers";

const ENGLISH_ONLY_CATALOG: readonly PublicSeoLocaleRoutingCatalogEntry[] = [
  {
    languageId: "lang-en",
    locale: "en",
    textDirection: "ltr",
    aliases: [],
    enabled: true,
    seoIndexingEnabled: true,
  },
];

function toSeoRoutingCatalog(
  catalog: readonly RuntimeLocaleCatalogEntry[],
): PublicSeoLocaleRoutingCatalogEntry[] {
  return catalog.map((row) => {
    const maybe = row as Partial<PublicSeoLocaleRoutingCatalogEntry>;
    return {
      languageId: row.languageId,
      locale: row.locale,
      textDirection: row.textDirection,
      aliases: row.aliases,
      enabled: maybe.enabled !== false,
      seoIndexingEnabled: maybe.seoIndexingEnabled === true,
    };
  });
}
async function fetchEnabledLocaleCatalogUncached(): Promise<
  readonly PublicSeoLocaleRoutingCatalogEntry[]
> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/languages`, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(2_500),
    });
    if (!response.ok) {
      return ENGLISH_ONLY_CATALOG;
    }
    const envelope = (await response.json()) as {
      success?: boolean;
      data?: LanguageRegistryPublicListResponse;
    };
    const languages = envelope.data?.languages;
    if (!Array.isArray(languages) || languages.length === 0) {
      return ENGLISH_ONLY_CATALOG;
    }
    return languages.map((row) => ({
      languageId: row.languageId,
      locale: row.locale,
      textDirection: row.textDirection,
      aliases: [...row.aliases],
      enabled: true,
      seoIndexingEnabled: row.seoIndexingEnabled === true,
    }));
  } catch {
    return ENGLISH_ONLY_CATALOG;
  }
}

/**
 * Reset 03D — request-scoped dedupe so layout + /media share one Registry fetch.
 * Not a process-lifetime cache (Admin enable/disable still propagates next request).
 */
const fetchEnabledLocaleCatalog = cache(fetchEnabledLocaleCatalogUncached);

async function readUrlLocaleSegment(
  override: string | null | undefined,
): Promise<string | null> {
  if (override !== undefined) {
    return override;
  }
  try {
    const headerStore = await headers();
    const fromHeader = headerStore.get(HU_URL_LOCALE_SEGMENT_HEADER);
    return fromHeader && fromHeader.trim().length > 0 ? fromHeader.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Pack 2.1 — full public SEO locale document resolution for the current request.
 */
export async function resolvePublicSeoLocaleDocumentForRequest(overrides?: {
  readonly urlLocaleSegment?: string | null;
  readonly huLangCookie?: string | null;
  readonly acceptLanguageHeader?: string | null;
  readonly catalog?: readonly RuntimeLocaleCatalogEntry[];
  readonly authenticated?: boolean;
  readonly participantInterfaceLanguage?: string | null;
}): Promise<PublicSeoLocaleDocumentResolution> {
  const catalog = toSeoRoutingCatalog(
    overrides?.catalog ?? (await fetchEnabledLocaleCatalog()),
  );
  const urlLocaleSegment = await readUrlLocaleSegment(overrides?.urlLocaleSegment);

  let huLangCookie = overrides?.huLangCookie ?? null;
  let acceptLanguageHeader = overrides?.acceptLanguageHeader ?? null;

  if (overrides?.huLangCookie === undefined || overrides?.acceptLanguageHeader === undefined) {
    try {
      if (overrides?.huLangCookie === undefined) {
        const cookieStore = await cookies();
        huLangCookie = cookieStore.get(HU_LANG_COOKIE_NAME)?.value ?? null;
      }
      if (overrides?.acceptLanguageHeader === undefined) {
        const headerStore = await headers();
        acceptLanguageHeader = headerStore.get("accept-language");
      }
    } catch {
      // Outside a request context (tests / build) — keep overrides / nulls.
    }
  }

  return resolvePublicSeoLocaleDocument({
    urlLocaleSegment,
    catalog,
    runtime: {
      authenticated: overrides?.authenticated === true,
      participantInterfaceLanguage: overrides?.participantInterfaceLanguage ?? null,
      huLangCookie,
      acceptLanguageHeader,
    },
  });
}

/**
 * Resolve document locale for the current Next.js request (server-only).
 * Pure catalog precedence — resolved on the server before paint.
 * Pack 2.1 — SEO URL locale segment overrides cookie / Accept-Language when valid.
 */
export async function resolveDocumentHtmlLocale(
  overrides?: {
    readonly urlLocaleSegment?: string | null;
    readonly huLangCookie?: string | null;
    readonly acceptLanguageHeader?: string | null;
    readonly catalog?: readonly RuntimeLocaleCatalogEntry[];
    readonly authenticated?: boolean;
    readonly participantInterfaceLanguage?: string | null;
  },
): Promise<ResolvedRuntimeLocale> {
  const document = await resolvePublicSeoLocaleDocumentForRequest(overrides);
  return document.effectiveLocale;
}

export function englishDocumentLocaleFallback(): ResolvedRuntimeLocale {
  return ENGLISH_RUNTIME_LOCALE_FALLBACK;
}
