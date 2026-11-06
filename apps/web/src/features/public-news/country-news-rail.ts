/**
 * COUNTRY-MEDIA-NEWS-01 — source-based Country News rail.
 *
 * Provider options come from the country's configured NEWS_SOURCE resources, never
 * from the articles on screen. Articles are fetched by exact source name.
 * Global fallback outlets are used only for the "All" view, when the country has no
 * sources or none of them has articles, and are always labelled as global.
 * Fetch errors propagate so the widget shows its error state instead of a fallback.
 */

import type { PublicCountryNewsSource, PublicNewsArticleItem } from "@hu/types";
import { COUNTRY_NEWS_RAIL_LIMIT, listCountryNewsFallbackSourceNames } from "@hu/media-registry";

export const COUNTRY_NEWS_ALL_PROVIDERS = "all";

export interface CountryNewsProviderOptions {
  /** "country": the country's own sources. "global": the labelled fallback outlets. */
  readonly group: "country" | "global";
  readonly names: readonly string[];
}

export interface CountryNewsRailResult {
  readonly articles: readonly PublicNewsArticleItem[];
  readonly usedGlobalFallback: boolean;
}

export type FetchCountryNewsArticles = (
  sources: readonly string[],
) => Promise<readonly PublicNewsArticleItem[]>;

export function resolveCountryNewsProviderOptions(
  sources: readonly PublicCountryNewsSource[],
): CountryNewsProviderOptions {
  const names = [...new Set(sources.map((source) => source.name))];
  return names.length > 0
    ? { group: "country", names }
    : { group: "global", names: listCountryNewsFallbackSourceNames() };
}

export async function loadCountryNewsRail(input: {
  readonly options: CountryNewsProviderOptions;
  readonly provider: string;
  readonly fetchArticles: FetchCountryNewsArticles;
}): Promise<CountryNewsRailResult> {
  const { options, provider, fetchArticles } = input;
  const globalGroup = options.group === "global";

  if (provider !== COUNTRY_NEWS_ALL_PROVIDERS && options.names.includes(provider)) {
    const selected = await fetchArticles([provider]);
    return {
      articles: selected.slice(0, COUNTRY_NEWS_RAIL_LIMIT),
      usedGlobalFallback: globalGroup,
    };
  }

  if (!globalGroup) {
    const own = (await fetchArticles(options.names)).slice(0, COUNTRY_NEWS_RAIL_LIMIT);
    if (own.length > 0) {
      return { articles: own, usedGlobalFallback: false };
    }
  }

  const fallback = await fetchArticles(listCountryNewsFallbackSourceNames());
  return { articles: fallback.slice(0, COUNTRY_NEWS_RAIL_LIMIT), usedGlobalFallback: true };
}
