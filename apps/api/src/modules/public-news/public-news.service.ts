import type {
  InitiativeNewsSourceReference,
  MediaResource,
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
import {
  listActiveApprovedNewsSourceLanguages,
  resolvePublicNewsConfig,
} from "./public-news.config.js";
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
import { PublicNewsIngestionTelemetry } from "./public-news-source-health.js";
import { recordPublicNewsSourceChecks } from "./public-news-source-health.repository.js";
import {
  tryAcquirePublicNewsRefreshLease,
  type PublicNewsRefreshLease,
  type PublicNewsRefreshLeaseResult,
} from "./public-news-refresh-lease.js";

/** Telemetry is best-effort: a storage failure must never affect ingestion. */
async function flushSourceHealthTelemetry(telemetry: PublicNewsIngestionTelemetry): Promise<void> {
  try {
    await recordPublicNewsSourceChecks(telemetry.completed());
  } catch {
    console.warn("[public-news] Source health telemetry could not be stored.");
  }
}

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
  /** MEDIA-NEWS-01B — explicit /media carousel selection (filters not allowed). */
  carousel?: "media";
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
  let carousel: PublicNewsQuery["carousel"];
  if (query.carousel !== undefined) {
    if (query.carousel !== "media") {
      throw new Error('carousel supports only "media".');
    }
    if (category || source || sources) {
      throw new Error("carousel cannot be combined with category, source or sources.");
    }
    carousel = "media";
  }

  return {
    limit,
    language,
    category,
    source,
    ...(sources ? { sources } : {}),
    ...(carousel ? { carousel } : {}),
  };
}

/**
 * Requested names that belong to an active NEWS_SOURCE resource, plus those resources'
 * ids (articles stored since RSS-SOURCE-02B carry the id). Disabled sources return nothing.
 */
function resolveActiveNewsSourceSelection(
  names: readonly string[],
  activeResources: readonly MediaResource[],
): { sources: string[]; sourceIds: string[] } {
  const requested = new Set(names);
  const matches = activeResources.filter(
    (resource) => resource.resourceType === "NEWS_SOURCE" && requested.has(resource.name),
  );
  const activeNames = new Set(matches.map((resource) => resource.name));
  return {
    sources: names.filter((name) => activeNames.has(name)),
    sourceIds: [...new Set(matches.map((resource) => resource.id))],
  };
}

export async function listPublicNewsArticles(
  query: PublicNewsQuery,
): Promise<PublicNewsListingResponse> {
  const config = resolvePublicNewsConfig();
  const language = query.language ?? config.defaultLanguage;
  const { listMediaResources } =
    await import("../media-resources/persistence/media-resource.repository.js");
  const { createNewsSourceLogoResolver, selectMediaCarouselNewsRecords } =
    await import("./public-news-media-carousel.js");
  // One read of active resources serves source filtering, carousel and logos.
  const activeResources = await listMediaResources({ active: true });
  const selection = query.sources
    ? resolveActiveNewsSourceSelection(query.sources, activeResources)
    : undefined;
  const records =
    query.carousel === "media"
      ? await selectMediaCarouselNewsRecords({
          limit: query.limit,
          language,
          resources: activeResources,
        })
      : await findActivePublicNewsRecords({
          limit: query.limit,
          language,
          category: query.category,
          source: query.source,
          ...(selection ? selection : {}),
        });
  const activeProviders = await findActivePublicNewsSourceNames({ language });
  const logoFor = createNewsSourceLogoResolver(activeResources);

  return {
    items: records.map((record) => ({ ...toPublicNewsArticleItem(record), ...logoFor(record) })),
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

export interface PublicNewsRefreshResult {
  upserted: number;
  fetched: number;
  /**
   * Set when nothing was fetched or written: another instance holds the lease or
   * already refreshed, the lease store failed, or the lease was lost mid-refresh.
   * Existing public articles are left untouched in every case.
   */
  skipped?: "lease_held" | "completed_elsewhere" | "lease_unavailable" | "lease_lost";
  /** With `lease_held`: when the current lease expires (epoch ms). */
  retryAt?: number;
}

/** Storage failures fail closed: no lease means no fetch and no writes this cycle. */
async function acquireRefreshLease(options: {
  skipIfCompletedSince?: Date;
}): Promise<PublicNewsRefreshLeaseResult | null> {
  try {
    return await tryAcquirePublicNewsRefreshLease(options);
  } catch {
    console.warn("[public-news] Refresh lease unavailable; skipping this refresh.");
    return null;
  }
}

/** Languages to ingest: the default first, then each other active source language. */
function resolveIngestionLanguages(defaultLanguage: string): string[] {
  return [
    ...new Set([
      defaultLanguage.toLowerCase(),
      ...listActiveApprovedNewsSourceLanguages().map((language) => language.toLowerCase()),
    ]),
  ];
}

export async function refreshPublicNews(
  options: { skipIfCompletedSince?: Date } = {},
): Promise<PublicNewsRefreshResult> {
  if (refreshInProgress) {
    return { upserted: 0, fetched: 0 };
  }

  refreshInProgress = true;
  let lease: PublicNewsRefreshLease | null = null;
  let completed = false;

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

    const leaseResult = await acquireRefreshLease(options);
    if (!leaseResult) {
      return { upserted: 0, fetched: 0, skipped: "lease_unavailable" };
    }
    if (!leaseResult.acquired) {
      return leaseResult.reason === "held"
        ? { upserted: 0, fetched: 0, skipped: "lease_held", retryAt: leaseResult.retryAt }
        : { upserted: 0, fetched: 0, skipped: "completed_elsewhere" };
    }
    lease = leaseResult.lease;
    const heldLease = lease;
    const leaseLost = async () => {
      if (await heldLease.confirm()) {
        return false;
      }
      console.warn("[public-news] Refresh lease lost; discarding this refresh without writes.");
      return true;
    };

    const fetchedArticles: ExternalNewsArticle[] = [];
    const telemetry = new PublicNewsIngestionTelemetry();

    try {
      // Each language keeps its own fetch limit, so other-language sources never
      // displace default-language articles from the global cap.
      for (const language of resolveIngestionLanguages(config.defaultLanguage)) {
        fetchedArticles.push(
          ...(await provider.fetchRecentArticles({
            language,
            limit: config.fetchLimit,
            telemetry,
          })),
        );
      }
    } catch (error) {
      console.error(
        "[public-news] Provider fetch failed:",
        error instanceof Error ? error.message : error,
      );
      if (await leaseLost()) {
        return { upserted: 0, fetched: 0, skipped: "lease_lost" };
      }
      await flushSourceHealthTelemetry(telemetry);
      return { upserted: 0, fetched: 0 };
    }

    const filtered = filterExternalNewsArticles(fetchedArticles, {
      retentionDays: config.retentionDays,
      onReject: (article, reason) => telemetry.reject(article.mediaResourceId, reason),
    });

    const validated = await validateExternalNewsArticleUrls(filtered, (article) =>
      telemetry.reject(article.mediaResourceId, "url_validation_failed"),
    );

    const normalized = validated
      .map((article) => {
        try {
          const record = normalizeExternalNewsArticle(article, config.retentionDays);
          telemetry.accept(article.mediaResourceId, record.sourceName);
          return record;
        } catch {
          telemetry.reject(article.mediaResourceId, "normalization_failed");
          return null;
        }
      })
      .filter((record): record is NewsArticleRecord => record !== null);

    if (await leaseLost()) {
      return { upserted: 0, fetched: fetchedArticles.length, skipped: "lease_lost" };
    }

    const upserted = await upsertPublicNewsRecords(normalized);
    await flushSourceHealthTelemetry(telemetry);

    for (const record of normalized) {
      // Other-language articles are shown in their original language only; they are
      // not announced to the localization pipeline.
      if (
        record.status === "active" &&
        record.language.toLowerCase() === config.defaultLanguage.toLowerCase()
      ) {
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

    completed = true;
    return {
      upserted,
      fetched: fetchedArticles.length,
    };
  } finally {
    if (lease) {
      await lease.release({ completed }).catch(() => {
        console.warn("[public-news] Refresh lease could not be released; it will expire.");
      });
    }
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
