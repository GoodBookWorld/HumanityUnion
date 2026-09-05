/**
 * Pack 08K.2.8 — narrow Mongo projections for residual diagnostics.
 * Never builds PublicLocalizedPresentation trees.
 * Never imports civic Map stores / comment service / translation service.
 */

import type { ContentTranslationSourceKind, LanguageCode } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import { sanitizeBlogHtml } from "../../blog/blog-content-sanitize.js";
import { parseContentTranslationFailureMetadata } from "../content-translation-failure-metadata.js";
import { buildContentTranslationSourceVersion } from "../content-translation-version.js";
import type { ResidualWarmAttemptLike } from "../content-translation-residual-state-core.js";
import type { ThinResidualIdentity } from "./parse-residual-args.js";
import {
  markThinOutboxRowsInspected,
  markThinSourceRecordsLoaded,
  markThinTranslationRowsLoaded,
} from "./thin-counters.js";

export type ThinSourceLookupResult = {
  readonly sourceExists: boolean;
  readonly sourceVersion: string | null;
  /** Counts only this identity's direct Mongo source find — never corpus scans. */
  readonly sourceRecordsLoaded: 0 | 1;
};

export type ThinTranslationLookupResult = {
  readonly translationRowExists: boolean;
  readonly translationSourceVersion: string | null;
  readonly translationFreshness: string | null;
  readonly translationStale: boolean | null;
  readonly translationUpdatedAt: string | null;
  readonly translationRowsLoaded: 0 | 1;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Load only fields required to compute sourceVersion for supported residual kinds.
 * Prose is read solely to hash version identity — never returned to CLI output.
 */
export async function loadThinSourceVersionMetadata(
  identity: ThinResidualIdentity,
): Promise<ThinSourceLookupResult> {
  switch (identity.sourceKind) {
    case "initiative": {
      const collection = getMongoCollection<Record<string, unknown>>(
        MONGO_COLLECTIONS.initiatives,
      );
      const doc = await collection.findOne(
        { initiativeId: identity.sourceRecordId },
        { projection: { title: 1, description: 1, updatedAt: 1, initiativeId: 1 } },
      );
      if (!doc) {
        markThinSourceRecordsLoaded(0);
        return { sourceExists: false, sourceVersion: null, sourceRecordsLoaded: 0 };
      }
      markThinSourceRecordsLoaded(1);
      const sourceVersion = buildContentTranslationSourceVersion({
        fields: {
          title: asString(doc.title),
          description: asString(doc.description),
        },
        versionStamp: asString(doc.updatedAt) || "unknown",
      });
      return { sourceExists: true, sourceVersion, sourceRecordsLoaded: 1 };
    }
    case "collaborative_analysis": {
      const collection = getMongoCollection<Record<string, unknown>>(
        MONGO_COLLECTIONS.initiativeAnalyses,
      );
      const doc = await collection.findOne(
        { analysisId: identity.sourceRecordId },
        {
          projection: {
            analysisId: 1,
            title: 1,
            summary: 1,
            supportingEvidence: 1,
            risks: 1,
            openQuestions: 1,
            suggestedImprovements: 1,
            references: 1,
            updatedAt: 1,
          },
        },
      );
      if (!doc) {
        markThinSourceRecordsLoaded(0);
        return { sourceExists: false, sourceVersion: null, sourceRecordsLoaded: 0 };
      }
      markThinSourceRecordsLoaded(1);
      const sourceVersion = buildContentTranslationSourceVersion({
        fields: {
          title: asString(doc.title),
          summary: asString(doc.summary),
          supportingEvidence: asString(doc.supportingEvidence),
          risks: asString(doc.risks),
          openQuestions: asString(doc.openQuestions),
          suggestedImprovements: asString(doc.suggestedImprovements),
          references: asString(doc.references),
        },
        versionStamp: asString(doc.updatedAt) || "unknown",
      });
      return { sourceExists: true, sourceVersion, sourceRecordsLoaded: 1 };
    }
    case "discussion_comment": {
      const collection = getMongoCollection<Record<string, unknown>>(
        MONGO_COLLECTIONS.initiativeComments,
      );
      const doc = await collection.findOne(
        { commentId: identity.sourceRecordId },
        {
          projection: {
            commentId: 1,
            body: 1,
            updatedAt: 1,
            status: 1,
            deletedAt: 1,
          },
        },
      );
      if (!doc) {
        markThinSourceRecordsLoaded(0);
        return { sourceExists: false, sourceVersion: null, sourceRecordsLoaded: 0 };
      }
      markThinSourceRecordsLoaded(1);
      if (doc.status !== "approved" || doc.deletedAt) {
        return { sourceExists: false, sourceVersion: null, sourceRecordsLoaded: 1 };
      }
      const sourceVersion = buildContentTranslationSourceVersion({
        fields: { body: asString(doc.body) },
        versionStamp: asString(doc.updatedAt) || "unknown",
      });
      return { sourceExists: true, sourceVersion, sourceRecordsLoaded: 1 };
    }
    case "blog_post": {
      const collection = getMongoCollection<Record<string, unknown>>(
        MONGO_COLLECTIONS.blogPosts,
      );
      const doc = await collection.findOne(
        { postId: identity.sourceRecordId },
        {
          projection: {
            postId: 1,
            title: 1,
            excerpt: 1,
            content: 1,
            updatedAt: 1,
            publishedVersion: 1,
            status: 1,
          },
        },
      );
      if (!doc) {
        markThinSourceRecordsLoaded(0);
        return { sourceExists: false, sourceVersion: null, sourceRecordsLoaded: 0 };
      }
      markThinSourceRecordsLoaded(1);
      const sourceVersion = buildContentTranslationSourceVersion({
        fields: {
          title: asString(doc.title),
          excerpt: asString(doc.excerpt),
          content: sanitizeBlogHtml(asString(doc.content)),
        },
        versionStamp: asString(doc.updatedAt) || "unknown",
        publishedVersion:
          typeof doc.publishedVersion === "number" || typeof doc.publishedVersion === "string"
            ? doc.publishedVersion
            : undefined,
      });
      return { sourceExists: true, sourceVersion, sourceRecordsLoaded: 1 };
    }
    case "public_news": {
      const collection = getMongoCollection<Record<string, unknown>>(
        MONGO_COLLECTIONS.publicNewsArticles,
      );
      const doc = await collection.findOne(
        { id: identity.sourceRecordId },
        {
          projection: {
            id: 1,
            title: 1,
            summary: 1,
            category: 1,
            updatedAt: 1,
            status: 1,
            expiresAt: 1,
            language: 1,
          },
        },
      );
      if (!doc) {
        markThinSourceRecordsLoaded(0);
        return { sourceExists: false, sourceVersion: null, sourceRecordsLoaded: 0 };
      }
      markThinSourceRecordsLoaded(1);
      if (doc.status !== "active") {
        return { sourceExists: false, sourceVersion: null, sourceRecordsLoaded: 1 };
      }
      const sourceVersion = buildContentTranslationSourceVersion({
        fields: {
          title: asString(doc.title),
          summary: asString(doc.summary),
          category: asString(doc.category),
        },
        versionStamp: "semantic",
      });
      return { sourceExists: true, sourceVersion, sourceRecordsLoaded: 1 };
    }
    default:
      markThinSourceRecordsLoaded(0);
      return { sourceExists: false, sourceVersion: null, sourceRecordsLoaded: 0 };
  }
}

export async function loadThinTranslationRow(input: {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceRecordId: string;
  readonly sourceVersion: string;
  readonly targetLocale: LanguageCode;
}): Promise<ThinTranslationLookupResult> {
  const collection = getMongoCollection<Record<string, unknown>>(
    MONGO_COLLECTIONS.contentTranslations,
  );
  const doc = await collection.findOne(
    {
      sourceKind: input.sourceKind,
      sourceRecordId: input.sourceRecordId,
      sourceVersion: input.sourceVersion,
      targetLanguage: input.targetLocale,
    },
    {
      projection: {
        sourceVersion: 1,
        freshness: 1,
        stale: 1,
        updatedAt: 1,
        createdAt: 1,
      },
    },
  );
  if (!doc) {
    markThinTranslationRowsLoaded(0);
    return {
      translationRowExists: false,
      translationSourceVersion: null,
      translationFreshness: null,
      translationStale: null,
      translationUpdatedAt: null,
      translationRowsLoaded: 0,
    };
  }
  markThinTranslationRowsLoaded(1);
  return {
    translationRowExists: true,
    translationSourceVersion: asString(doc.sourceVersion) || null,
    translationFreshness: asString(doc.freshness) || null,
    translationStale: doc.stale === true,
    translationUpdatedAt: asString(doc.updatedAt) || asString(doc.createdAt) || null,
    translationRowsLoaded: 1,
  };
}

const WARM_EVENT = "ContentTranslationWarmRequested";
export const THIN_WARM_ATTEMPTS_LIST_LIMIT = 10;

export async function listThinWarmAttemptsBounded(input: {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceRecordId: string;
  readonly limit?: number;
}): Promise<{
  readonly attempts: readonly ResidualWarmAttemptLike[];
  readonly outboxRowsInspected: number;
}> {
  const aggregateId = `${input.sourceKind}::${input.sourceRecordId.trim()}`;
  const limit = Math.min(50, Math.max(1, input.limit ?? THIN_WARM_ATTEMPTS_LIST_LIMIT));
  const collection = getMongoCollection<{
    eventId: string;
    status: string;
    eventName: string;
    aggregateId: string;
    envelope?: string;
    lastError?: string | null;
    createdAt?: string;
    publishedAt?: string | null;
  }>(MONGO_COLLECTIONS.outbox);

  const rows = await collection
    .find({
      eventName: WARM_EVENT,
      aggregateId,
    })
    .sort({ createdAt: -1, eventId: -1 })
    .limit(limit)
    .toArray();

  markThinOutboxRowsInspected(rows.length);

  const attempts: ResidualWarmAttemptLike[] = rows.map((row) => {
    let payload: Record<string, unknown> | null = null;
    if (typeof row.envelope === "string") {
      try {
        payload =
          (JSON.parse(row.envelope) as { payload?: Record<string, unknown> }).payload ?? null;
      } catch {
        payload = null;
      }
    }
    const requestedAt =
      (typeof payload?.requestedAt === "string" && payload.requestedAt) ||
      (typeof row.createdAt === "string" ? row.createdAt : "") ||
      "";
    const lastError = typeof row.lastError === "string" ? row.lastError : null;
    const failureMetadata = parseContentTranslationFailureMetadata(lastError);
    let failedAtFromMeta: string | null = failureMetadata?.failedAt ?? null;
    if (!failedAtFromMeta && lastError?.startsWith("CT_FAIL_META_V1:")) {
      try {
        const raw = JSON.parse(lastError.slice("CT_FAIL_META_V1:".length)) as {
          failedAt?: unknown;
        };
        failedAtFromMeta = typeof raw.failedAt === "string" ? raw.failedAt : null;
      } catch {
        failedAtFromMeta = null;
      }
    }
    const targetLocales = Array.isArray(payload?.targetLocales)
      ? ([
          ...new Set(
            payload.targetLocales
              .filter((locale): locale is string => typeof locale === "string")
              .map((locale) => locale.trim())
              .filter(Boolean),
          ),
        ] as LanguageCode[])
      : null;
    const status =
      row.status === "pending" || row.status === "published" || row.status === "failed"
        ? row.status
        : "failed";
    const attemptAt =
      (status === "published" && typeof row.publishedAt === "string"
        ? row.publishedAt
        : null) ||
      (status === "failed" ? failedAtFromMeta : null) ||
      (typeof row.createdAt === "string" ? row.createdAt : requestedAt);
    return {
      eventId: String(row.eventId),
      status,
      reason: typeof payload?.reason === "string" ? payload.reason : null,
      architectureRetryBasis:
        typeof payload?.architectureRetryBasis === "string"
          ? payload.architectureRetryBasis
          : null,
      requestedAt,
      attemptAt,
      targetLocales: targetLocales?.length ? targetLocales : null,
      lastError,
      failureMetadata,
    };
  });

  attempts.sort((a, b) => {
    const byTime = a.attemptAt.localeCompare(b.attemptAt);
    return byTime !== 0 ? byTime : a.eventId.localeCompare(b.eventId);
  });

  return { attempts, outboxRowsInspected: rows.length };
}

export async function isThinLocaleContentTranslationEnabled(
  locale: LanguageCode,
): Promise<boolean> {
  const collection = getMongoCollection<{
    locale: string;
    enabled?: boolean;
    contentTranslationEnabled?: boolean;
  }>(MONGO_COLLECTIONS.languageRegistry);
  const doc = await collection.findOne(
    { locale },
    { projection: { locale: 1, enabled: 1, contentTranslationEnabled: 1 } },
  );
  return Boolean(doc?.enabled && doc.contentTranslationEnabled);
}
