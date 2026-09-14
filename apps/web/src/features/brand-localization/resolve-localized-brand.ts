/**
 * Pack 08I.2 — client/server fetch for Admin-managed localized brand.
 * Sync fallback to builtin English when fetch fails. Never calls Gemini.
 */

import type { ResolvedLocalizedBrand } from "@hu/types";
import { CANONICAL_ENGLISH_BRAND_FALLBACK } from "@hu/types";

import { API_BASE_URL } from "../../lib/api-base-url";

export const BRAND_LOCALIZATION_CLIENT_CACHE_TTL_MS = 30_000;

function builtinResolved(requestedLocale: string): ResolvedLocalizedBrand {
  return {
    locale: "en",
    requestedLocale,
    siteName: CANONICAL_ENGLISH_BRAND_FALLBACK.siteName,
    shortName: CANONICAL_ENGLISH_BRAND_FALLBACK.shortName,
    slogan: CANONICAL_ENGLISH_BRAND_FALLBACK.slogan,
    heroUnityQuote: CANONICAL_ENGLISH_BRAND_FALLBACK.heroUnityQuote,
    seoSiteName: CANONICAL_ENGLISH_BRAND_FALLBACK.seoSiteName,
    seoTitleSuffix: CANONICAL_ENGLISH_BRAND_FALLBACK.seoTitleSuffix,
    defaultMetaDescription: CANONICAL_ENGLISH_BRAND_FALLBACK.defaultMetaDescription,
    openGraphBrandName: CANONICAL_ENGLISH_BRAND_FALLBACK.openGraphBrandName,
    source: "builtin_english",
  };
}

interface CacheEntry {
  readonly data: ResolvedLocalizedBrand;
  fetchedAtMs: number;
}

const clientCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<ResolvedLocalizedBrand>>();

export function resetLocalizedBrandCacheForTests(): void {
  clientCache.clear();
  inFlight.clear();
}

function parseResolved(payload: unknown, requestedLocale: string): ResolvedLocalizedBrand {
  const envelope = payload as {
    success?: boolean;
    data?: ResolvedLocalizedBrand;
  };
  const data = envelope.data;
  if (
    !data ||
    typeof data.siteName !== "string" ||
    typeof data.slogan !== "string" ||
    typeof data.heroUnityQuote !== "string" ||
    typeof data.seoSiteName !== "string"
  ) {
    return builtinResolved(requestedLocale);
  }
  return data;
}

async function fetchResolvedBrand(locale: string): Promise<ResolvedLocalizedBrand> {
  const requested = locale.trim() || "en";
  const response = await fetch(
    `${API_BASE_URL}/api/v1/brand-localization?locale=${encodeURIComponent(requested)}`,
    {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
      credentials: "omit",
    },
  );
  if (!response.ok) {
    return builtinResolved(requested);
  }
  return parseResolved(await response.json(), requested);
}

/**
 * Resolve localized brand for a locale with short client cache.
 * On network/parse failure returns builtin English synchronously-shaped fallback.
 */
export async function resolveLocalizedBrandForLocale(
  locale: string,
): Promise<ResolvedLocalizedBrand> {
  const key = locale.trim() || "en";
  const now = Date.now();
  const cached = clientCache.get(key);
  if (cached && now - cached.fetchedAtMs < BRAND_LOCALIZATION_CLIENT_CACHE_TTL_MS) {
    return cached.data;
  }

  const pending = inFlight.get(key);
  if (pending) {
    return pending;
  }

  const promise = (async () => {
    try {
      const data = await fetchResolvedBrand(key);
      clientCache.set(key, { data, fetchedAtMs: Date.now() });
      return data;
    } catch {
      const fallback = builtinResolved(key);
      clientCache.set(key, { data: fallback, fetchedAtMs: Date.now() });
      return fallback;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise;
}

/** Sync builtin fallback for first paint / SSR failure paths. */
export function getBuiltinEnglishBrand(requestedLocale = "en"): ResolvedLocalizedBrand {
  return builtinResolved(requestedLocale);
}
