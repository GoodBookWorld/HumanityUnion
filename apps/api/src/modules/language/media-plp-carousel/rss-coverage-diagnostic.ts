/**
 * RESET 05C — read-only RSS PLP coverage across /media (12) and country pool (24).
 *
 * PROVIDER_CALLS=0, PLP_WRITES=0, MONGO_WRITES=0.
 *
 * Usage:
 *   pnpm --filter @hu/api diagnose:media-plp-rss-coverage -- --mongo --locale uk
 */

import {
  MEDIA_PLP_ENTITY_TYPE,
  mediaPlpPublicNewsEntityId,
  type NewsArticleRecord,
} from "@hu/types";

import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../infrastructure/mongodb/mongo-connection.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { findCurrentPublishedPresentation } from "../published-localized-presentation/persistence/repository.js";
import {
  fingerprintMediaPlpCanonicalVersion,
  buildCanonicalPublicNewsPresentation,
  asMediaPlpPresentationNode,
} from "../published-localized-presentation/media/canonical-trees.js";
import { resolveMediaPlpConsumerBatch } from "../published-localized-presentation/media/resolve-consumer.js";
import { classifyUsableLocalizedPresentation } from "../published-localized-presentation/usability.js";
import {
  getMediaPlpPersistenceObservability,
  requireMediaPlpMaterializerMongoPersistence,
  type MediaPlpPersistenceObservability,
} from "../media-plp-materializer/persistence-selection.js";
import { MEDIA_PLP_CAROUSEL_NEWS_LIMIT } from "./constants.js";
import {
  MEDIA_PLP_AUTO_BUILD_NEWS_LIMIT,
  selectMediaPlpConsumerNewsArticles,
} from "./media-plp-news-selection.js";

export const MEDIA_PLP_RSS_COVERAGE_PACK = "RESET_05C" as const;

export type MediaPlpRssCoverageSurface = "media_rail" | "country_pool";

export type MediaPlpRssCoverageRow = {
  readonly ENTITY_ID: string;
  readonly ARTICLE_ID: string;
  readonly SURFACES: readonly MediaPlpRssCoverageSurface[];
  readonly CANONICAL_VERSION: string;
  readonly LOCALE: string;
  readonly SNAPSHOT_USABLE: boolean;
  readonly SNAPSHOT_USABILITY: string | null;
  readonly RESOLVER_MODE: "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK" | "BATCH_MISSING";
  readonly RESOLVER_REASON: string | null;
  readonly IDENTITY_MATCH: boolean;
};

export type MediaPlpRssCoverageReport = {
  readonly pack: typeof MEDIA_PLP_RSS_COVERAGE_PACK;
  readonly locale: string;
  readonly PLP_PERSISTENCE_MODE: "MONGO" | "MEMORY" | "UNSET";
  readonly MEDIA_RAIL_LIMIT: typeof MEDIA_PLP_CAROUSEL_NEWS_LIMIT;
  readonly COUNTRY_POOL_LIMIT: typeof MEDIA_PLP_AUTO_BUILD_NEWS_LIMIT;
  readonly UNIQUE_IDS: number;
  readonly MEDIA_RAIL_COUNT: number;
  readonly COUNTRY_POOL_COUNT: number;
  readonly MEDIA_SUBSET_OF_UNION: boolean;
  readonly PUBLISHED_LOCALIZED: number;
  readonly CANONICAL_FALLBACK: number;
  readonly STALE: number;
  readonly MISSING: number;
  readonly IDENTITY_MISMATCHES: number;
  readonly PROVIDER_CALLS: 0;
  readonly PLP_WRITES: 0;
  readonly MONGO_WRITES: 0;
  readonly rows: readonly MediaPlpRssCoverageRow[];
};

export type MediaPlpRssCoverageDiagnosticDeps = {
  readonly isMongoConfigured?: () => boolean;
  readonly requirePersistence?: () => MediaPlpPersistenceObservability;
  readonly connect?: () => Promise<void>;
  readonly disconnect?: () => Promise<void>;
  readonly executeReads?: (input: {
    readonly locale: string;
    readonly persistence: MediaPlpPersistenceObservability;
  }) => Promise<MediaPlpRssCoverageReport>;
};

function surfacesForId(
  articleId: string,
  mediaIds: ReadonlySet<string>,
  countryIds: ReadonlySet<string>,
): MediaPlpRssCoverageSurface[] {
  const surfaces: MediaPlpRssCoverageSurface[] = [];
  if (mediaIds.has(articleId)) {
    surfaces.push("media_rail");
  }
  if (countryIds.has(articleId)) {
    surfaces.push("country_pool");
  }
  return surfaces;
}

export async function executeMediaPlpRssCoverageReads(input: {
  readonly locale: string;
  readonly persistence: MediaPlpPersistenceObservability;
  readonly selectArticles?: (args: {
    readonly limit: number;
  }) => Promise<readonly NewsArticleRecord[]>;
}): Promise<MediaPlpRssCoverageReport> {
  const locale = input.locale.trim().toLowerCase();
  const select = input.selectArticles ?? selectMediaPlpConsumerNewsArticles;

  const mediaArticles = await select({ limit: MEDIA_PLP_CAROUSEL_NEWS_LIMIT });
  const countryArticles = await select({ limit: MEDIA_PLP_AUTO_BUILD_NEWS_LIMIT });

  const mediaIds = new Set(mediaArticles.map((a) => a.id));
  const countryIds = new Set(countryArticles.map((a) => a.id));
  const mediaSubsetOfUnion = [...mediaIds].every((id) => countryIds.has(id));

  const byId = new Map<string, NewsArticleRecord>();
  for (const article of countryArticles) {
    byId.set(article.id, article);
  }
  for (const article of mediaArticles) {
    byId.set(article.id, article);
  }

  const batchItems = [...byId.values()].map((article) => {
    const tree = asMediaPlpPresentationNode(
      buildCanonicalPublicNewsPresentation({
        id: article.id,
        title: article.title,
        summary: article.summary,
        category: article.category,
        sourceName: article.sourceName,
        articleUrl: article.articleUrl,
        publishedAt: article.publishedAt,
        verificationStatus: article.verificationStatus,
        geographicScope: article.geographicScope,
        language: article.language,
        imageUrl: article.imageUrl,
      }),
    );
    return {
      entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
      entityId: mediaPlpPublicNewsEntityId(article.id),
      canonicalPresentation: tree,
      liveVersion: fingerprintMediaPlpCanonicalVersion(tree),
      articleId: article.id,
    };
  });

  const batch = await resolveMediaPlpConsumerBatch({
    locale,
    items: batchItems.map(({ entityType, entityId, canonicalPresentation }) => ({
      entityType,
      entityId,
      canonicalPresentation,
    })),
  });
  if (!batch.ok) {
    throw new Error(batch.error ?? "resolveMediaPlpConsumerBatch failed");
  }
  const byEntityId = new Map(batch.results.map((row) => [row.entityId, row]));

  const rows: MediaPlpRssCoverageRow[] = [];
  let published = 0;
  let fallback = 0;
  let stale = 0;
  let missing = 0;
  let identityMismatches = 0;

  for (const item of batchItems) {
    const snapshot = await findCurrentPublishedPresentation({
      entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
      entityId: item.entityId,
      locale,
    });
    const usability = classifyUsableLocalizedPresentation({
      locale,
      liveCanonicalVersion: item.liveVersion,
      canonicalPresentation: item.canonicalPresentation,
      snapshot,
    });
    const http = byEntityId.get(item.entityId);
    const resolverMode = http
      ? http.mode
      : ("BATCH_MISSING" as const);
    const identityMatch = !http || http.entityId === item.entityId;
    if (!identityMatch) {
      identityMismatches += 1;
    }

    if (resolverMode === "PUBLISHED_LOCALIZED") {
      published += 1;
    } else {
      fallback += 1;
    }
    if (!snapshot) {
      missing += 1;
    } else if (
      snapshot.identity.canonicalVersion !== item.liveVersion ||
      usability.reason === "CANONICAL_VERSION_MISMATCH"
    ) {
      stale += 1;
    }

    rows.push({
      ENTITY_ID: item.entityId,
      ARTICLE_ID: item.articleId,
      SURFACES: surfacesForId(item.articleId, mediaIds, countryIds),
      CANONICAL_VERSION: item.liveVersion,
      LOCALE: locale,
      SNAPSHOT_USABLE: usability.allowPublishedLocalized,
      SNAPSHOT_USABILITY: usability.reason,
      RESOLVER_MODE: resolverMode,
      RESOLVER_REASON: http?.reasonCode ?? usability.resolveReasonCode,
      IDENTITY_MATCH: identityMatch,
    });
  }

  return {
    pack: MEDIA_PLP_RSS_COVERAGE_PACK,
    locale,
    PLP_PERSISTENCE_MODE: input.persistence.PLP_PERSISTENCE_MODE,
    MEDIA_RAIL_LIMIT: MEDIA_PLP_CAROUSEL_NEWS_LIMIT,
    COUNTRY_POOL_LIMIT: MEDIA_PLP_AUTO_BUILD_NEWS_LIMIT,
    UNIQUE_IDS: rows.length,
    MEDIA_RAIL_COUNT: mediaArticles.length,
    COUNTRY_POOL_COUNT: countryArticles.length,
    MEDIA_SUBSET_OF_UNION: mediaSubsetOfUnion,
    PUBLISHED_LOCALIZED: published,
    CANONICAL_FALLBACK: fallback,
    STALE: stale,
    MISSING: missing,
    IDENTITY_MISMATCHES: identityMismatches,
    PROVIDER_CALLS: 0,
    PLP_WRITES: 0,
    MONGO_WRITES: 0,
    rows,
  };
}

export async function runMediaPlpRssCoverageDiagnostic(
  input: { readonly locale: string },
  deps: MediaPlpRssCoverageDiagnosticDeps = {},
): Promise<{
  readonly exitCode: number;
  readonly report: MediaPlpRssCoverageReport | null;
  readonly errorMessage: string | null;
}> {
  const mongoReady = (deps.isMongoConfigured ?? isMongoConfigured)();
  if (!mongoReady) {
    return {
      exitCode: 1,
      report: null,
      errorMessage: "MONGODB_URI is not configured.",
    };
  }

  let persistence: MediaPlpPersistenceObservability;
  try {
    persistence = deps.requirePersistence
      ? deps.requirePersistence()
      : requireMediaPlpMaterializerMongoPersistence(
          "diagnose:media-plp-rss-coverage --mongo",
        );
  } catch (error) {
    return {
      exitCode: 1,
      report: null,
      errorMessage:
        error instanceof Error
          ? error.message
          : "Mongo PLP persistence required",
    };
  }
  if (persistence.PLP_PERSISTENCE_MODE !== "MONGO") {
    return {
      exitCode: 1,
      report: null,
      errorMessage:
        "PLP persistence mode is not MONGO (diagnose:media-plp-rss-coverage --mongo).",
    };
  }

  const locale = input.locale.trim().toLowerCase();
  let connected = false;
  try {
    await (deps.connect ?? connectMongoClient)();
    connected = true;
    const report = await (deps.executeReads ?? executeMediaPlpRssCoverageReads)({
      locale,
      persistence,
    });
    return { exitCode: 0, report, errorMessage: null };
  } catch (error) {
    return {
      exitCode: 1,
      report: null,
      errorMessage:
        error instanceof Error
          ? error.message
          : "rss coverage diagnostic failed",
    };
  } finally {
    if (connected) {
      try {
        await (deps.disconnect ?? disconnectMongoClient)();
      } catch {
        // ignore
      }
    }
  }
}

export function printMediaPlpRssCoverageReport(
  report: MediaPlpRssCoverageReport,
): void {
  console.log(
    JSON.stringify(
      {
        pack: report.pack,
        locale: report.locale,
        PLP_PERSISTENCE_MODE: report.PLP_PERSISTENCE_MODE,
        MEDIA_RAIL_LIMIT: report.MEDIA_RAIL_LIMIT,
        COUNTRY_POOL_LIMIT: report.COUNTRY_POOL_LIMIT,
        UNIQUE_IDS: report.UNIQUE_IDS,
        MEDIA_RAIL_COUNT: report.MEDIA_RAIL_COUNT,
        COUNTRY_POOL_COUNT: report.COUNTRY_POOL_COUNT,
        MEDIA_SUBSET_OF_UNION: report.MEDIA_SUBSET_OF_UNION,
        PUBLISHED_LOCALIZED: report.PUBLISHED_LOCALIZED,
        CANONICAL_FALLBACK: report.CANONICAL_FALLBACK,
        STALE: report.STALE,
        MISSING: report.MISSING,
        IDENTITY_MISMATCHES: report.IDENTITY_MISMATCHES,
        PROVIDER_CALLS: report.PROVIDER_CALLS,
        PLP_WRITES: report.PLP_WRITES,
        MONGO_WRITES: report.MONGO_WRITES,
      },
      null,
      2,
    ),
  );
  for (const row of report.rows) {
    console.log(
      [
        row.ENTITY_ID,
        `surfaces=${row.SURFACES.join("+") || "-"}`,
        `usable=${row.SNAPSHOT_USABLE ? "Y" : "N"}`,
        `http=${row.RESOLVER_MODE}`,
        `reason=${row.RESOLVER_REASON ?? "-"}`,
        `identity=${row.IDENTITY_MATCH ? "Y" : "N"}`,
      ].join(" | "),
    );
  }
}

export function parseMediaPlpRssCoverageArgs(argv: readonly string[]): {
  readonly locale: string;
  readonly mongo: boolean;
} {
  let locale = "uk";
  let mongo = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === "--mongo") {
      mongo = true;
    }
    if (arg === "--locale") {
      locale = argv[i + 1]?.trim() || locale;
      i += 1;
    }
  }
  return { locale, mongo };
}

export { getMediaPlpPersistenceObservability };
