/**
 * Reset 03E.13 / RESET 05C / RESET 05D — authoritative public_news selection.
 *
 * /media PLP batch: limit 12 (unchanged 03E.13).
 * Country rails: shared country-first selector (media-registry).
 * Auto-build: media-12 ∪ country-rail IDs for requested countries ∪ country-affiliated sources.
 */

import type { NewsArticleRecord } from "@hu/types";
import {
  COUNTRY_PUBLIC_NEWS_CANDIDATE_LIMIT,
  COUNTRY_PUBLIC_NEWS_RAIL_LIMIT,
  selectCountryPublicNewsRail,
  TRUSTED_GLOBAL_MEDIA_REGISTRY,
  type CountryPublicNewsContext,
} from "@hu/media-registry";

import { findActivePublicNewsRecords } from "../../public-news/public-news.repository.js";
import { MEDIA_PLP_CAROUSEL_NEWS_LIMIT } from "./constants.js";

/** Same language Web /media SSR passes to the public news listing. */
export const MEDIA_PLP_NEWS_CONSUMER_LANGUAGE = "en";

/**
 * RESET 05C — historical union label. RESET 05D auto-build expands beyond
 * truncate-then-filter; keep export for diagnostic compatibility.
 */
export const MEDIA_PLP_AUTO_BUILD_NEWS_LIMIT = COUNTRY_PUBLIC_NEWS_RAIL_LIMIT;

/**
 * Articles that belong in the /media PLP batch and carousel materializer inventory.
 * Default limit 12 — DO NOT change for 03E.13 parity.
 */
export async function selectMediaPlpConsumerNewsArticles(input?: {
  readonly limit?: number;
  readonly now?: string;
}): Promise<readonly NewsArticleRecord[]> {
  return findActivePublicNewsRecords({
    limit: input?.limit ?? MEDIA_PLP_CAROUSEL_NEWS_LIMIT,
    language: MEDIA_PLP_NEWS_CONSUMER_LANGUAGE,
    now: input?.now,
  });
}

export async function selectMediaPlpConsumerNewsIds(input?: {
  readonly limit?: number;
  readonly now?: string;
}): Promise<readonly string[]> {
  const records = await selectMediaPlpConsumerNewsArticles(input);
  return records.map((record) => record.id);
}

/**
 * RESET 05D — shared country rail selector (same as live country consumer).
 * Loads a candidate corpus first, then country-first + global supplement.
 */
export async function selectCountryPublicNewsRailArticles(input: {
  readonly context: CountryPublicNewsContext;
  readonly limit?: number;
  readonly candidateLimit?: number;
  readonly now?: string;
}): Promise<{
  readonly articles: readonly NewsArticleRecord[];
  readonly countryRelevantCount: number;
  readonly countryRelevantExcludedByCap: number;
  readonly usedFallback: boolean;
}> {
  const limit = input.limit ?? COUNTRY_PUBLIC_NEWS_RAIL_LIMIT;
  const candidates = await findActivePublicNewsRecords({
    limit: input.candidateLimit ?? COUNTRY_PUBLIC_NEWS_CANDIDATE_LIMIT,
    language: MEDIA_PLP_NEWS_CONSUMER_LANGUAGE,
    now: input.now,
  });
  const selected = selectCountryPublicNewsRail(candidates, input.context, limit);
  return {
    articles: selected.articles,
    countryRelevantCount: selected.countryRelevant.length,
    countryRelevantExcludedByCap: selected.countryRelevantExcludedByCap,
    usedFallback: selected.usedFallback,
  };
}

function countryAffiliatedSourceNames(): Set<string> {
  const names = new Set<string>();
  for (const provider of TRUSTED_GLOBAL_MEDIA_REGISTRY) {
    if (!provider.countryCode) {
      continue;
    }
    names.add(provider.name);
    for (const alias of provider.aliases ?? []) {
      names.add(alias);
    }
  }
  return names;
}

/**
 * RESET 05D — consumer-visible union for automatic PLP builds:
 * exact /media 12 + country-affiliated source articles from the candidate pool
 * (so country rails are not stuck waiting on global top-24 truncation).
 */
export async function selectConsumerVisibleNewsArticlesForAutoBuild(input?: {
  readonly now?: string;
  readonly countryContexts?: readonly CountryPublicNewsContext[];
}): Promise<readonly NewsArticleRecord[]> {
  const mediaRail = await selectMediaPlpConsumerNewsArticles({
    limit: MEDIA_PLP_CAROUSEL_NEWS_LIMIT,
    now: input?.now,
  });
  const candidates = await findActivePublicNewsRecords({
    limit: COUNTRY_PUBLIC_NEWS_CANDIDATE_LIMIT,
    language: MEDIA_PLP_NEWS_CONSUMER_LANGUAGE,
    now: input?.now,
  });
  const affiliated = countryAffiliatedSourceNames();
  const byId = new Map<string, NewsArticleRecord>();
  for (const article of mediaRail) {
    byId.set(article.id, article);
  }
  for (const article of candidates) {
    if (affiliated.has(article.sourceName)) {
      byId.set(article.id, article);
    }
  }
  for (const context of input?.countryContexts ?? []) {
    const countryRail = selectCountryPublicNewsRail(
      candidates,
      context,
      COUNTRY_PUBLIC_NEWS_RAIL_LIMIT,
    );
    for (const article of countryRail.articles) {
      byId.set(article.id, article);
    }
  }
  return [...byId.values()];
}

export async function selectConsumerVisibleNewsIdsForAutoBuild(input?: {
  readonly now?: string;
  readonly countryContexts?: readonly CountryPublicNewsContext[];
}): Promise<readonly string[]> {
  const records = await selectConsumerVisibleNewsArticlesForAutoBuild(input);
  return records.map((record) => record.id);
}

/**
 * Pre-03E.13 discovery shape (newest N, no language / no source balance).
 * Kept for parity diagnostics and regression proof only — not for materialize.
 */
export async function listNewestActivePublicNewsIdsIgnoringConsumerBalance(input: {
  readonly limit: number;
  readonly now?: string;
  readonly findDocs: (args: {
    readonly filter: Record<string, unknown>;
    readonly sort: Record<string, 1 | -1>;
    readonly limit: number;
  }) => Promise<readonly { readonly id?: unknown }[]>;
}): Promise<readonly string[]> {
  const now = input.now ?? new Date().toISOString();
  const docs = await input.findDocs({
    filter: {
      status: "active",
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: now } },
      ],
    },
    sort: { publishedAt: -1, id: 1 },
    limit: input.limit,
  });
  const ids: string[] = [];
  for (const doc of docs) {
    const id = typeof doc.id === "string" ? doc.id.trim() : "";
    if (id) {
      ids.push(id);
    }
  }
  return ids;
}
