import type {
  InitiativeNewsSourceReference,
  NewsArticleRecord,
  PublicNewsListingResponse,
} from "@hu/types";

import { notifyPublicPresentationChanged } from "../language/public-presentation-changed.js";
import {
  asMediaPlpPresentationNode,
  buildCanonicalPublicNewsPresentation,
  fingerprintMediaPlpCanonicalVersion,
} from "../language/published-localized-presentation/media/canonical-trees.js";
import { enqueueConsumerVisibleNewsPlpBuilds } from "../language/published-localized-presentation/universal/news-consumer-build-trigger.js";
import { resolvePlpAutoBuildLocales } from "../language/published-localized-presentation/universal/public-source-mutation-bridge.js";
import { resolvePublicNewsConfig } from "./public-news.config.js";
import type { ExternalNewsArticle } from "./public-news.normalize.js";
import { filterExternalNewsArticles, validateExternalNewsArticleUrls } from "./public-news.filter.js";
import {
  normalizeExternalNewsArticle,
  toInitiativeNewsSourceSnapshot,
  toPublicNewsArticleItem,
} from "./public-news.normalize.js";
import {
  deleteExpiredPublicNewsRecords,
  findActivePublicNewsRecords,
  findActivePublicNewsSourceNames,
  findPublicNewsRecordById,
  markExpiredPublicNewsRecords,
  markPlaceholderPublicNewsRecordsExpired,
  upsertPublicNewsRecords,
} from "./public-news.repository.js";
import { resolveNewsProvider } from "./providers/resolve-news-provider.js";

function fingerprintPublicNewsCanonicalVersion(record: NewsArticleRecord): string {
  const tree = asMediaPlpPresentationNode(
    buildCanonicalPublicNewsPresentation({
      id: record.id,
      title: record.title,
      summary: record.summary,
      category: record.category,
      sourceName: record.sourceName,
      articleUrl: record.articleUrl,
      publishedAt: record.publishedAt,
      verificationStatus: record.verificationStatus,
      geographicScope: record.geographicScope,
      language: record.language,
      imageUrl: record.imageUrl,
    }),
  );
  return fingerprintMediaPlpCanonicalVersion(tree);
}

let refreshInProgress = false;

export interface PublicNewsQuery {
  limit: number;
  language?: string;
  category?: string;
  source?: string;
  /** Exact source names (bounded, de-duplicated). */
  sources?: string[];
}

export const PUBLIC_NEWS_MAX_SOURCES = 20;
export const PUBLIC_NEWS_MAX_SOURCE_NAME_LENGTH = 120;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

/**
 * `sources` accepts repeated parameters and/or comma-separated values.
 * Names containing commas therefore cannot be requested through `sources`.
 */
function parseExactSources(raw: unknown): string[] | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const values = Array.isArray(raw) ? raw : [raw];
  if (values.some((value) => typeof value !== "string")) {
    throw new Error("sources must be a list of source names.");
  }
  const names = [
    ...new Set(
      (values as string[])
        .flatMap((value) => value.split(","))
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
  if (names.length === 0) {
    throw new Error("sources must include at least one source name.");
  }
  if (names.length > PUBLIC_NEWS_MAX_SOURCES) {
    throw new Error(`sources supports at most ${PUBLIC_NEWS_MAX_SOURCES} source names.`);
  }
  if (
    names.some(
      (name) => name.length > PUBLIC_NEWS_MAX_SOURCE_NAME_LENGTH || CONTROL_CHARACTERS.test(name),
    )
  ) {
    throw new Error("sources contains an invalid source name.");
  }
  return names;
}

export function parsePublicNewsQuery(query: Record<string, unknown>): PublicNewsQuery {
  const rawLimit = Number.parseInt(String(query.limit ?? "6"), 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 50) : 6;

  const language =
    typeof query.language === "string" && query.language.trim() ? query.language.trim() : undefined;
  const category =
    typeof query.category === "string" && query.category.trim() ? query.category.trim() : undefined;
  const source =
    typeof query.source === "string" && query.source.trim() ? query.source.trim() : undefined;
  const sources = parseExactSources(query.sources);

  return { limit, language, category, source, ...(sources ? { sources } : {}) };
}

/** Requested names that belong to an active NEWS_SOURCE resource; disabled sources return nothing. */
async function filterToActiveNewsSourceNames(names: readonly string[]): Promise<string[]> {
  const { listMediaResources } =
    await import("../media-resources/persistence/media-resource.repository.js");
  const active = new Set(
    (await listMediaResources({ resourceType: "NEWS_SOURCE", active: true })).map(
      (resource) => resource.name,
    ),
  );
  return names.filter((name) => active.has(name));
}

export async function listPublicNewsArticles(
  query: PublicNewsQuery,
): Promise<PublicNewsListingResponse> {
  const config = resolvePublicNewsConfig();
  const sources = query.sources ? await filterToActiveNewsSourceNames(query.sources) : undefined;
  const records = await findActivePublicNewsRecords({
    limit: query.limit,
    language: query.language ?? config.defaultLanguage,
    category: query.category,
    source: query.source,
    ...(sources ? { sources } : {}),
  });
  const activeProviders = await findActivePublicNewsSourceNames({
    language: query.language ?? config.defaultLanguage,
  });

  return {
    items: records.map(toPublicNewsArticleItem),
    generatedAt: new Date().toISOString(),
    retentionDays: config.retentionDays,
    activeProviders,
  };
}

export async function getPublicNewsArticleById(id: string): Promise<NewsArticleRecord | null> {
  const record = await findPublicNewsRecordById(id);

  if (!record) {
    return null;
  }

  if (record.status !== "active" || record.expiresAt <= new Date().toISOString()) {
    return null;
  }

  return record;
}

export async function buildInitiativeNewsSourceSnapshot(
  sourceNewsId: string,
): Promise<InitiativeNewsSourceReference> {
  const record = await findPublicNewsRecordById(sourceNewsId);

  if (!record) {
    throw new Error("News article not found.");
  }

  return toInitiativeNewsSourceSnapshot(record);
}

export async function refreshPublicNews(): Promise<{ upserted: number; fetched: number }> {
  if (refreshInProgress) {
    return { upserted: 0, fetched: 0 };
  }

  refreshInProgress = true;

  try {
    const { ensureMediaResourcesSeededOnce } = await import(
      "../media-resources/media-resource.service.js"
    );
    await ensureMediaResourcesSeededOnce();

    const config = resolvePublicNewsConfig();
    await markExpiredPublicNewsRecords();
    await markPlaceholderPublicNewsRecordsExpired();

    if (!config.enabled) {
      return { upserted: 0, fetched: 0 };
    }

    const provider = resolveNewsProvider();

    if (!provider) {
      return { upserted: 0, fetched: 0 };
    }

    let fetchedArticles: ExternalNewsArticle[] = [];

    try {
      fetchedArticles = await provider.fetchRecentArticles({
        language: config.defaultLanguage,
        limit: config.fetchLimit,
      });
    } catch (error) {
      console.error(
        "[public-news] Provider fetch failed:",
        error instanceof Error ? error.message : error,
      );
      return { upserted: 0, fetched: 0 };
    }

    const filtered = filterExternalNewsArticles(fetchedArticles, {
      retentionDays: config.retentionDays,
    });

    const validated = await validateExternalNewsArticleUrls(filtered);

    const normalized = validated
      .map((article) => {
        try {
          return normalizeExternalNewsArticle(article, config.retentionDays);
        } catch {
          return null;
        }
      })
      .filter((record): record is NewsArticleRecord => record !== null);

    const upserted = await upsertPublicNewsRecords(normalized);

    for (const record of normalized) {
      if (record.status === "active") {
        // RESET 05C — canonicalVersion required for PLP enqueue (mutation bridge).
        const canonicalVersion = fingerprintPublicNewsCanonicalVersion(record);
        notifyPublicPresentationChanged({
          sourceKind: "public_news",
          sourceRecordId: record.id,
          reason: "public_mutation",
          canonicalVersion,
        });
      }
    }

    // After ingest: bounded /media carousel PLP only (MEDIA_PLP_CAROUSEL_NEWS_LIMIT).
    // Await durable upserts only — never await provider builds. No per-item fan-out.
    const autoBuildLocales = await resolvePlpAutoBuildLocales();
    if (autoBuildLocales.length > 0) {
      await enqueueConsumerVisibleNewsPlpBuilds({ locales: autoBuildLocales });
    }

    return {
      upserted,
      fetched: fetchedArticles.length,
    };
  } finally {
    refreshInProgress = false;
  }
}

export async function cleanupExpiredPublicNews(): Promise<{ marked: number; deleted: number }> {
  const marked = await markExpiredPublicNewsRecords();
  const deleted = await deleteExpiredPublicNewsRecords();
  return { marked, deleted };
}

export function seedPublicNewsRecordForTests(record: NewsArticleRecord): void {
  void upsertPublicNewsRecords([record]);
}
