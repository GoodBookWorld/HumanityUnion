/**
 * Reset 03E.13 / 03E.13.1 — read-only public_news consumer parity diagnostic.
 * Compares /media consumer listing ↔ Mongo PLP current ↔ HTTP resolve mode.
 * PROVIDER_CALLS=0, PLP_WRITES=0, MONGO_WRITES=0.
 *
 * Reset 03E.13.1 — --mongo bootstrap parity with diagnose:media-plp-carousel /
 * materialize:media-plp-carousel: bind durable PLP → connectMongoClient →
 * reads → disconnect (never silent MEMORY; never read before connect).
 */

import {
  MEDIA_PLP_ENTITY_TYPE,
  PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
  mediaPlpPublicNewsEntityId,
  type NewsArticleRecord,
} from "@hu/types";

import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../infrastructure/mongodb/mongo-connection.js";
import {
  isMongoConfigured,
} from "../../../infrastructure/mongodb/mongo-config.js";
import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import { findCurrentPublishedPresentation } from "../published-localized-presentation/persistence/repository.js";
import {
  fingerprintMediaPlpCanonicalVersion,
  buildCanonicalPublicNewsPresentation,
  asMediaPlpPresentationNode,
} from "../published-localized-presentation/media/canonical-trees.js";
import { resolveMediaPlpConsumerBatch } from "../published-localized-presentation/media/resolve-consumer.js";
import {
  getMediaPlpPersistenceObservability,
  requireMediaPlpMaterializerMongoPersistence,
  type MediaPlpPersistenceObservability,
} from "../media-plp-materializer/persistence-selection.js";
import { MEDIA_PLP_CAROUSEL_NEWS_LIMIT } from "./constants.js";
import {
  listNewestActivePublicNewsIdsIgnoringConsumerBalance,
  selectMediaPlpConsumerNewsArticles,
} from "./media-plp-news-selection.js";

export const MEDIA_PLP_NEWS_PARITY_PACK = "RESET_03E.13" as const;

export type MediaPlpNewsParityClass =
  | "FOUND_AND_MATCHING"
  | "NO_SNAPSHOT"
  | "VERSION_MISMATCH"
  | "SCHEMA_MISMATCH"
  | "INTEGRITY_REJECTED"
  | "BATCH_MISSING"
  | "IDENTITY_MISMATCH"
  | "JOIN_MISMATCH"
  | "CANONICAL_FALLBACK";

export type MediaPlpNewsParityRow = {
  readonly ENTITY_ID: string;
  readonly CANONICAL_VERSION_MATERIALIZER: string;
  readonly PLP_LOOKUP: "FOUND" | "NOT_FOUND" | "ERROR";
  readonly PLP_SNAPSHOT_VERSION: string | null;
  readonly PLP_INTEGRITY: string | null;
  readonly HTTP_RESOLVER_MODE: "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK" | "BATCH_MISSING";
  readonly HTTP_REASON: string | null;
  readonly HTTP_ENTITY_ID: string | null;
  readonly HTTP_CANONICAL_VERSION: string | null;
  readonly WEB_JOIN_KEY: string;
  readonly EXPECTED_CONSUMER_MODE: "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK";
  readonly PARITY_CLASS: MediaPlpNewsParityClass;
  readonly IN_LEGACY_NEWEST_SET: boolean;
};

export type MediaPlpNewsParityReport = {
  readonly pack: typeof MEDIA_PLP_NEWS_PARITY_PACK;
  readonly locale: string;
  readonly PLP_PERSISTENCE_MODE: "MONGO" | "MEMORY" | "UNSET";
  readonly CONSUMER_NEWS_COUNT: number;
  readonly LEGACY_NEWEST_COUNT: number;
  readonly OVERLAP_WITH_LEGACY_NEWEST: number;
  readonly FOUND_AND_MATCHING: number;
  readonly CANONICAL_FALLBACK: number;
  readonly PROVIDER_CALLS: 0;
  readonly PLP_WRITES: 0;
  readonly MONGO_WRITES: 0;
  readonly rows: readonly MediaPlpNewsParityRow[];
};

export type MediaPlpNewsParityDiagnosticDeps = {
  readonly isMongoConfigured?: () => boolean;
  readonly requirePersistence?: () => MediaPlpPersistenceObservability;
  readonly connect?: () => Promise<void>;
  readonly disconnect?: () => Promise<void>;
  /** After bootstrap only — unit tests replace Mongo-backed reads. */
  readonly executeReads?: (input: {
    readonly locale: string;
    readonly limit: number;
    readonly persistence: MediaPlpPersistenceObservability;
  }) => Promise<MediaPlpNewsParityReport>;
};

function classifyParity(input: {
  readonly plpFound: boolean;
  readonly httpMode: MediaPlpNewsParityRow["HTTP_RESOLVER_MODE"];
  readonly httpReason: string | null;
  readonly httpEntityId: string | null;
  readonly entityId: string;
  readonly liveVersion: string;
  readonly snapshotVersion: string | null;
  readonly schema: string | null;
}): MediaPlpNewsParityClass {
  if (input.httpEntityId && input.httpEntityId !== input.entityId) {
    return "IDENTITY_MISMATCH";
  }
  if (input.httpMode === "BATCH_MISSING") {
    return "BATCH_MISSING";
  }
  if (!input.plpFound) {
    return "NO_SNAPSHOT";
  }
  if (
    input.schema &&
    input.schema !== PUBLISHED_LOCALIZATION_SCHEMA_VERSION
  ) {
    return "SCHEMA_MISMATCH";
  }
  if (
    input.snapshotVersion &&
    input.snapshotVersion !== input.liveVersion
  ) {
    return "VERSION_MISMATCH";
  }
  if (
    input.httpReason === "LOCALIZATION_CONTENT_INTEGRITY_FAILED" ||
    input.httpReason === "CONTENT_INTEGRITY_FAILED" ||
    (input.httpReason ?? "").includes("INTEGRITY")
  ) {
    return "INTEGRITY_REJECTED";
  }
  if (input.httpMode === "PUBLISHED_LOCALIZED") {
    return "FOUND_AND_MATCHING";
  }
  return "CANONICAL_FALLBACK";
}

/**
 * Mongo-backed parity reads. Caller MUST have connected the client and bound
 * durable PLP persistence already (03E.13.1).
 */
export async function executeMediaPlpNewsParityReads(input: {
  readonly locale: string;
  readonly limit: number;
  readonly persistence: MediaPlpPersistenceObservability;
  readonly selectConsumerArticles?: (args: {
    readonly limit: number;
  }) => Promise<readonly NewsArticleRecord[]>;
}): Promise<MediaPlpNewsParityReport> {
  const locale = input.locale.trim().toLowerCase();
  const limit = input.limit;
  const select =
    input.selectConsumerArticles ?? selectMediaPlpConsumerNewsArticles;
  const consumerArticles = await select({ limit });

  const collection = getMongoCollection<Record<string, unknown>>(
    MONGO_COLLECTIONS.publicNewsArticles,
  );
  const legacyNewest = await listNewestActivePublicNewsIdsIgnoringConsumerBalance({
    limit,
    findDocs: async ({ filter, sort, limit: lim }) => {
      const cursor = collection.find(filter, {
        projection: { id: 1 },
        sort,
        limit: lim,
      });
      const docs: { id?: unknown }[] = [];
      for await (const doc of cursor) {
        docs.push({ id: doc.id });
      }
      return docs;
    },
  });
  const legacySet = new Set(legacyNewest);

  const batchItems = consumerArticles.map((article) => {
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

  const byEntityId = new Map(
    batch.results.map((row) => [row.entityId, row]),
  );

  const rows: MediaPlpNewsParityRow[] = [];
  for (const item of batchItems) {
    const snapshot = await findCurrentPublishedPresentation({
      entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
      entityId: item.entityId,
      locale,
    });
    const http = byEntityId.get(item.entityId);
    const plpLookup = snapshot ? "FOUND" : "NOT_FOUND";
    const httpMode = http
      ? http.mode
      : ("BATCH_MISSING" as const);
    const httpReason = http?.reasonCode ?? null;
    const joinKey = mediaPlpPublicNewsEntityId(item.articleId);
    let parityClass = classifyParity({
      plpFound: Boolean(snapshot),
      httpMode,
      httpReason,
      httpEntityId: http?.entityId ?? null,
      entityId: item.entityId,
      liveVersion: item.liveVersion,
      snapshotVersion: snapshot?.identity.canonicalVersion ?? null,
      schema: snapshot?.identity.localizationSchemaVersion ?? null,
    });
    if (joinKey !== item.entityId) {
      parityClass = "JOIN_MISMATCH";
    }

    rows.push({
      ENTITY_ID: item.entityId,
      CANONICAL_VERSION_MATERIALIZER: item.liveVersion,
      PLP_LOOKUP: plpLookup,
      PLP_SNAPSHOT_VERSION: snapshot?.identity.canonicalVersion ?? null,
      PLP_INTEGRITY: snapshot?.contentIntegrity?.status ?? null,
      HTTP_RESOLVER_MODE: httpMode,
      HTTP_REASON: httpReason,
      HTTP_ENTITY_ID: http?.entityId ?? null,
      HTTP_CANONICAL_VERSION: http?.canonicalVersion ?? null,
      WEB_JOIN_KEY: item.articleId,
      EXPECTED_CONSUMER_MODE:
        parityClass === "FOUND_AND_MATCHING"
          ? "PUBLISHED_LOCALIZED"
          : "CANONICAL_FALLBACK",
      PARITY_CLASS: parityClass,
      IN_LEGACY_NEWEST_SET: legacySet.has(item.articleId),
    });
  }

  const overlap = rows.filter((r) => r.IN_LEGACY_NEWEST_SET).length;

  return {
    pack: MEDIA_PLP_NEWS_PARITY_PACK,
    locale,
    PLP_PERSISTENCE_MODE: input.persistence.PLP_PERSISTENCE_MODE,
    CONSUMER_NEWS_COUNT: rows.length,
    LEGACY_NEWEST_COUNT: legacyNewest.length,
    OVERLAP_WITH_LEGACY_NEWEST: overlap,
    FOUND_AND_MATCHING: rows.filter((r) => r.PARITY_CLASS === "FOUND_AND_MATCHING")
      .length,
    CANONICAL_FALLBACK: rows.filter(
      (r) =>
        r.PARITY_CLASS !== "FOUND_AND_MATCHING" &&
        r.EXPECTED_CONSUMER_MODE === "CANONICAL_FALLBACK",
    ).length,
    PROVIDER_CALLS: 0,
    PLP_WRITES: 0,
    MONGO_WRITES: 0,
    rows,
  };
}

/**
 * Operator entry: bind Mongo PLP → connect → read-only parity → disconnect.
 * Same contract as diagnose:media-plp-carousel / materialize:media-plp-carousel (03E.10.1).
 */
export async function runMediaPlpNewsParityDiagnostic(
  input: {
    readonly locale: string;
    readonly limit?: number;
  },
  deps: MediaPlpNewsParityDiagnosticDeps = {},
): Promise<{
  readonly exitCode: number;
  readonly report: MediaPlpNewsParityReport | null;
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
          "diagnose:media-plp-news-parity --mongo",
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
        "PLP persistence mode is not MONGO (diagnose:media-plp-news-parity --mongo). Refusing silent memory fallback.",
    };
  }

  const limit = input.limit ?? MEDIA_PLP_CAROUSEL_NEWS_LIMIT;
  const locale = input.locale.trim().toLowerCase();
  let connected = false;
  try {
    await (deps.connect ?? connectMongoClient)();
    connected = true;

    const report = await (deps.executeReads ?? executeMediaPlpNewsParityReads)({
      locale,
      limit,
      persistence,
    });

    if (report.PLP_PERSISTENCE_MODE !== "MONGO") {
      return {
        exitCode: 1,
        report: null,
        errorMessage:
          "Parity report persistence mode is not MONGO; refusing memory fallback.",
      };
    }

    return { exitCode: 0, report, errorMessage: null };
  } catch (error) {
    return {
      exitCode: 1,
      report: null,
      errorMessage:
        error instanceof Error ? error.message : "news parity diagnostic failed",
    };
  } finally {
    if (connected) {
      try {
        await (deps.disconnect ?? disconnectMongoClient)();
      } catch {
        // ignore disconnect errors
      }
    }
  }
}

export function printMediaPlpNewsParityReport(
  report: MediaPlpNewsParityReport,
): void {
  console.log(
    JSON.stringify(
      {
        pack: report.pack,
        locale: report.locale,
        PLP_PERSISTENCE_MODE: report.PLP_PERSISTENCE_MODE,
        CONSUMER_NEWS_COUNT: report.CONSUMER_NEWS_COUNT,
        LEGACY_NEWEST_COUNT: report.LEGACY_NEWEST_COUNT,
        OVERLAP_WITH_LEGACY_NEWEST: report.OVERLAP_WITH_LEGACY_NEWEST,
        FOUND_AND_MATCHING: report.FOUND_AND_MATCHING,
        CANONICAL_FALLBACK: report.CANONICAL_FALLBACK,
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
        `class=${row.PARITY_CLASS}`,
        `plp=${row.PLP_LOOKUP}`,
        `http=${row.HTTP_RESOLVER_MODE}`,
        `reason=${row.HTTP_REASON ?? "-"}`,
        `join=${row.WEB_JOIN_KEY}`,
        `legacyNewest=${row.IN_LEGACY_NEWEST_SET ? "Y" : "N"}`,
      ].join(" | "),
    );
  }
}

export function parseMediaPlpNewsParityArgs(argv: readonly string[]): {
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

/** Observability helper for tests — does not connect. */
export { getMediaPlpPersistenceObservability };
