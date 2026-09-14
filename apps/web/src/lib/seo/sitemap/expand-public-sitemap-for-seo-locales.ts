/**
 * Step 07E — expand canonical sitemap paths with Registry SEO locale prefixes.
 *
 * Pure path transform only. Uses PUBLIC_SEO_LOCALE_PATH_PATTERNS via
 * `isPublicSeoLocalePath` / `buildPublicSeoLocalePrefixedPath` — no second route list.
 * English/default never receives `/en/...`. Outside perimeter → locale-free only.
 */

import {
  DEFAULT_PLATFORM_LANGUAGE,
  buildPublicSeoLocalePrefixedPath,
  isPublicSeoLocalePath,
  normalizeLanguageRegistryLocaleKey,
} from "@hu/types";

import { normalizeCanonicalPath } from "../public-site-url";
import { dedupeSitemapPathEntries } from "./dedupe-sitemap-entries";
import type { SitemapPathEntry } from "./types";

function listNonDefaultSeoLocales(
  seoIndexableLocales: readonly string[],
  defaultLocale: string = DEFAULT_PLATFORM_LANGUAGE,
): string[] {
  const defaultKey = normalizeLanguageRegistryLocaleKey(defaultLocale);
  const out: string[] = [];
  const seen = new Set<string>();

  for (const raw of seoIndexableLocales) {
    const locale = typeof raw === "string" ? raw.trim() : "";
    if (!locale) {
      continue;
    }
    const key = normalizeLanguageRegistryLocaleKey(locale);
    if (!key || key === defaultKey || seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(locale);
  }

  return out.sort((a, b) => a.localeCompare(b));
}

/**
 * Expand canonical (locale-free) sitemap entries with SEO-indexable locale prefixes.
 *
 * - Preserves canonical entries and their lastModified
 * - Locale variants copy lastModified from the canonical entry
 * - Deterministic: canonicals keep input order; variants follow each expandable
 *   entry in sorted locale order; final dedupe keeps first occurrence
 */
export function expandPublicSitemapEntriesForSeoLocales(input: {
  readonly entries: readonly SitemapPathEntry[];
  /** Locales already filtered to enabled && seoIndexingEnabled. */
  readonly seoIndexableLocales: readonly string[];
  readonly defaultLocale?: string;
}): SitemapPathEntry[] {
  const nonDefaultLocales = listNonDefaultSeoLocales(
    input.seoIndexableLocales,
    input.defaultLocale ?? DEFAULT_PLATFORM_LANGUAGE,
  );

  const expanded: SitemapPathEntry[] = [];

  for (const entry of input.entries) {
    const path = normalizeCanonicalPath(entry.path);
    const canonical: SitemapPathEntry = {
      path,
      ...(entry.lastModified !== undefined ? { lastModified: entry.lastModified } : {}),
    };
    expanded.push(canonical);

    if (nonDefaultLocales.length === 0 || !isPublicSeoLocalePath(path)) {
      continue;
    }

    for (const locale of nonDefaultLocales) {
      expanded.push({
        path: buildPublicSeoLocalePrefixedPath(path, locale),
        ...(entry.lastModified !== undefined ? { lastModified: entry.lastModified } : {}),
      });
    }
  }

  return dedupeSitemapPathEntries(expanded);
}
