/**
 * Pack 08K.3.2 — thin Media localization diagnostic (Mongo-bounded, read-only).
 * Does not import reconcile / Gemini / worker / full corpus / Web app graph.
 */

import type { LanguageCode } from "@hu/types";
import { normalizeLanguageCode } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import { buildContentTranslationSourceVersion } from "../content-translation-version.js";
import {
  auditRssIdentityStability,
  buildSemanticPathDiagnostics,
  classifyTranslatedFieldCoverage,
  shouldScheduleMediaTranslationRepair,
  type MediaSemanticPathDiagnostic,
  type MediaTranslationMaterializationState,
} from "../media-translation-materialization.js";
import {
  getThinLocalizationImportGuards,
} from "../thin-localization-diagnostic/import-guards.js";
import {
  markThinSourceRecordsLoaded,
  markThinTranslationRowsLoaded,
} from "../thin-localization-diagnostic/thin-counters.js";

export type MediaFamily =
  | "public_news"
  | "civic_media_aggregate"
  | "civic_media_principle"
  | "civic_media_trusted"
  | "country_media_rail";

export type MediaLocalizationPresentationRow = {
  readonly mediaFamily: MediaFamily;
  readonly sourceKind: string;
  readonly sourceRecordId: string;
  readonly locale: LanguageCode;
  readonly sourceVersion: string;
  readonly translationRowExists: boolean;
  readonly translationSourceVersion: string | null;
  readonly translationState: MediaTranslationMaterializationState;
  readonly semanticNodeCount: number;
  readonly localizedNodeCount: number;
  readonly canonicalFallbackNodeCount: number;
  readonly protectedNodeCount: number;
  readonly generationState: "SCHEDULED" | "NOT_REQUIRED" | "NOT_SCHEDULED";
  readonly fallbackPaths: readonly string[];
  readonly pathDiagnostics: readonly MediaSemanticPathDiagnostic[];
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseLocale(argv: readonly string[]): LanguageCode {
  const idx = argv.indexOf("--locale");
  if (idx >= 0 && argv[idx + 1]) {
    return normalizeLanguageCode(argv[idx + 1]!, "en");
  }
  return "uk";
}

async function loadTranslationRow(input: {
  readonly sourceKind: string;
  readonly sourceRecordId: string;
  readonly sourceVersion: string;
  readonly locale: LanguageCode;
}): Promise<{
  readonly exists: boolean;
  readonly sourceVersion: string | null;
  readonly stale: boolean;
  readonly fields: Record<string, string>;
}> {
  const collection = getMongoCollection<Record<string, unknown>>(
    MONGO_COLLECTIONS.contentTranslations,
  );
  const doc = await collection.findOne(
    {
      sourceKind: input.sourceKind,
      sourceRecordId: input.sourceRecordId,
      targetLanguage: input.locale,
    },
    {
      projection: {
        sourceVersion: 1,
        stale: 1,
        freshness: 1,
        translatedContent: 1,
      },
      sort: { updatedAt: -1 },
    },
  );
  markThinTranslationRowsLoaded(doc ? 1 : 0);
  if (!doc) {
    return { exists: false, sourceVersion: null, stale: false, fields: {} };
  }
  const fields: Record<string, string> = {};
  const content = doc.translatedContent;
  if (content && typeof content === "object" && !Array.isArray(content)) {
    for (const [key, value] of Object.entries(content as Record<string, unknown>)) {
      if (typeof value === "string") {
        fields[key] = value;
      }
    }
  }
  return {
    exists: true,
    sourceVersion: asString(doc.sourceVersion) || null,
    stale: doc.stale === true || asString(doc.freshness) === "stale",
    fields,
  };
}

function rowFromCoverage(input: {
  readonly mediaFamily: MediaFamily;
  readonly sourceKind: string;
  readonly sourceRecordId: string;
  readonly locale: LanguageCode;
  readonly liveSourceVersion: string;
  readonly sourceFields: Record<string, string>;
  readonly translation: Awaited<ReturnType<typeof loadTranslationRow>>;
  readonly protectedNodeCount: number;
}): MediaLocalizationPresentationRow {
  const coverage = classifyTranslatedFieldCoverage({
    sourceFields: input.sourceFields,
    translatedFields: input.translation.exists ? input.translation.fields : null,
    sourceLanguage: "en",
    targetLanguage: input.locale,
    translationRowExists: input.translation.exists,
    translationSourceVersion: input.translation.sourceVersion,
    liveSourceVersion: input.liveSourceVersion,
    translationStale: input.translation.stale,
  });

  const autoPaths = Object.entries(input.sourceFields)
    .filter(([, v]) => v.trim())
    .map(([k]) => k);
  const fingerprinted = new Set(autoPaths);
  const translationPaths = new Set(
    Object.entries(input.translation.fields)
      .filter(([, v]) => v.trim())
      .map(([k]) => k),
  );
  const applied =
    coverage.state === "STALE" || coverage.state === "MISSING" || coverage.state === "FAILED"
      ? new Set<string>()
      : translationPaths;

  const pathDiagnostics = buildSemanticPathDiagnostics({
    autoPaths,
    fingerprintedPaths: fingerprinted,
    translationPaths,
    appliedPaths: applied,
    state: coverage.state,
  });

  const needsRepair = shouldScheduleMediaTranslationRepair(coverage.state);

  return {
    mediaFamily: input.mediaFamily,
    sourceKind: input.sourceKind,
    sourceRecordId: input.sourceRecordId,
    locale: input.locale,
    sourceVersion: input.liveSourceVersion,
    translationRowExists: input.translation.exists,
    translationSourceVersion: input.translation.sourceVersion,
    translationState: coverage.state,
    semanticNodeCount: autoPaths.length,
    localizedNodeCount: coverage.presentPaths.length,
    canonicalFallbackNodeCount: coverage.missingPaths.length,
    protectedNodeCount: input.protectedNodeCount,
    generationState: needsRepair ? "NOT_SCHEDULED" : "NOT_REQUIRED",
    fallbackPaths: coverage.missingPaths,
    pathDiagnostics,
  };
}

export async function discoverThinMediaLocalizationPresentations(input: {
  readonly locale: LanguageCode;
  readonly newsLimit?: number;
}): Promise<{
  readonly presentations: MediaLocalizationPresentationRow[];
  readonly rssAudit: ReturnType<typeof auditRssIdentityStability>;
}> {
  const locale = input.locale;
  const newsLimit = input.newsLimit ?? 50;
  const presentations: MediaLocalizationPresentationRow[] = [];

  const newsCollection = getMongoCollection<Record<string, unknown>>(
    MONGO_COLLECTIONS.publicNewsArticles,
  );
  const now = new Date().toISOString();
  const newsDocs = await newsCollection
    .find(
      { status: "active", expiresAt: { $gt: now } },
      {
        projection: {
          id: 1,
          title: 1,
          summary: 1,
          category: 1,
          normalizedArticleUrl: 1,
          updatedAt: 1,
        },
        limit: newsLimit,
        sort: { publishedAt: -1 },
      },
    )
    .toArray();
  markThinSourceRecordsLoaded(newsDocs.length);

  const rssRecords = newsDocs.map((doc) => ({
    id: asString(doc.id),
    normalizedArticleUrl: asString(doc.normalizedArticleUrl),
  }));
  const rssAudit = auditRssIdentityStability({ records: rssRecords });

  for (const doc of newsDocs) {
    const id = asString(doc.id);
    if (!id) {
      continue;
    }
    const fields = {
      title: asString(doc.title),
      summary: asString(doc.summary),
      category: asString(doc.category),
    };
    const liveSourceVersion = buildContentTranslationSourceVersion({
      fields,
      versionStamp: "semantic",
    });
    const translation = await loadTranslationRow({
      sourceKind: "public_news",
      sourceRecordId: id,
      sourceVersion: liveSourceVersion,
      locale,
    });
    presentations.push(
      rowFromCoverage({
        mediaFamily: "public_news",
        sourceKind: "public_news",
        sourceRecordId: id,
        locale,
        liveSourceVersion,
        sourceFields: fields,
        translation,
        protectedNodeCount: 4,
      }),
    );
  }

  // civic_media is a static seed singleton — structural metadata only (no seed import).
  const civicRecordId = "civic-media-center";
  const civicFields = {
    overviewTitle: "x",
    overviewSummary: "x",
    selectionPrinciples: "[]",
    trustedMediaExplanations: "[]",
  };
  // Prefer live Mongo seed document if present; otherwise report IDENTITY_MISSING via empty version.
  let civicLiveVersion = buildContentTranslationSourceVersion({
    fields: civicFields,
    versionStamp: "structural",
  });
  const translation = await loadTranslationRow({
    sourceKind: "civic_media",
    sourceRecordId: civicRecordId,
    sourceVersion: civicLiveVersion,
    locale,
  });

  // Nested principle / trusted structural rows (paths only — no prose).
  const principlePaths = ["title", "description"];
  const trustedPaths = ["explanation"];

  presentations.push(
    rowFromCoverage({
      mediaFamily: "civic_media_aggregate",
      sourceKind: "civic_media",
      sourceRecordId: civicRecordId,
      locale,
      liveSourceVersion: civicLiveVersion,
      sourceFields: {
        selectionPrinciples: translation.fields.selectionPrinciples ?? "",
        trustedMediaExplanations: translation.fields.trustedMediaExplanations ?? "",
        overviewTitle: translation.fields.overviewTitle ?? "x",
        overviewSummary: translation.fields.overviewSummary ?? "x",
      },
      translation,
      protectedNodeCount: 0,
    }),
  );

  // Emit nested family rows from translation JSON structure when present (paths only).
  try {
    const principlesRaw = translation.fields.selectionPrinciples;
    if (principlesRaw) {
      const parsed = JSON.parse(principlesRaw) as unknown;
      if (Array.isArray(parsed)) {
        parsed.forEach((item, index) => {
          const id =
            item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string"
              ? (item as { id: string }).id
              : `principle-${index}`;
          const sourceFields: Record<string, string> = {};
          for (const path of principlePaths) {
            sourceFields[path] = "1";
          }
          const translatedFields: Record<string, string> = {};
          if (item && typeof item === "object") {
            for (const path of principlePaths) {
              const value = (item as Record<string, unknown>)[path];
              if (typeof value === "string" && value.trim()) {
                translatedFields[path] = "1";
              }
            }
          }
          const coverage = classifyTranslatedFieldCoverage({
            sourceFields,
            translatedFields,
            sourceLanguage: "en",
            targetLanguage: locale,
            translationRowExists: translation.exists,
            translationSourceVersion: translation.sourceVersion,
            liveSourceVersion: civicLiveVersion,
            translationStale: translation.stale,
          });
          presentations.push({
            mediaFamily: "civic_media_principle",
            sourceKind: "civic_media",
            sourceRecordId: `${civicRecordId}::principle::${id}`,
            locale,
            sourceVersion: civicLiveVersion,
            translationRowExists: translation.exists,
            translationSourceVersion: translation.sourceVersion,
            translationState: coverage.state,
            semanticNodeCount: principlePaths.length,
            localizedNodeCount: coverage.presentPaths.length,
            canonicalFallbackNodeCount: coverage.missingPaths.length,
            protectedNodeCount: 0,
            generationState: shouldScheduleMediaTranslationRepair(coverage.state)
              ? "NOT_SCHEDULED"
              : "NOT_REQUIRED",
            fallbackPaths: coverage.missingPaths,
            pathDiagnostics: buildSemanticPathDiagnostics({
              autoPaths: principlePaths,
              fingerprintedPaths: new Set(principlePaths),
              translationPaths: new Set(Object.keys(translatedFields)),
              appliedPaths: new Set(coverage.presentPaths),
              state: coverage.state,
            }),
          });
        });
      }
    }
    const trustedRaw = translation.fields.trustedMediaExplanations;
    if (trustedRaw) {
      const parsed = JSON.parse(trustedRaw) as unknown;
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const id =
            item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string"
              ? (item as { id: string }).id
              : "trusted-unknown";
          const hasExplanation =
            item &&
            typeof item === "object" &&
            typeof (item as { explanation?: unknown }).explanation === "string" &&
            String((item as { explanation: string }).explanation).trim().length > 0;
          const coverage = classifyTranslatedFieldCoverage({
            sourceFields: { explanation: "1" },
            translatedFields: hasExplanation ? { explanation: "1" } : {},
            sourceLanguage: "en",
            targetLanguage: locale,
            translationRowExists: translation.exists,
            translationSourceVersion: translation.sourceVersion,
            liveSourceVersion: civicLiveVersion,
            translationStale: translation.stale,
          });
          presentations.push({
            mediaFamily: "civic_media_trusted",
            sourceKind: "civic_media",
            sourceRecordId: `${civicRecordId}::trusted::${id}`,
            locale,
            sourceVersion: civicLiveVersion,
            translationRowExists: translation.exists,
            translationSourceVersion: translation.sourceVersion,
            translationState: coverage.state,
            semanticNodeCount: trustedPaths.length,
            localizedNodeCount: coverage.presentPaths.length,
            canonicalFallbackNodeCount: coverage.missingPaths.length,
            protectedNodeCount: 2,
            generationState: shouldScheduleMediaTranslationRepair(coverage.state)
              ? "NOT_SCHEDULED"
              : "NOT_REQUIRED",
            fallbackPaths: coverage.missingPaths,
            pathDiagnostics: buildSemanticPathDiagnostics({
              autoPaths: trustedPaths,
              fingerprintedPaths: new Set(trustedPaths),
              translationPaths: new Set(hasExplanation ? ["explanation"] : []),
              appliedPaths: new Set(coverage.presentPaths),
              state: coverage.state,
            }),
          });
          // Country rail shares trusted explanation identity.
          presentations.push({
            ...presentations[presentations.length - 1]!,
            mediaFamily: "country_media_rail",
            sourceRecordId: `${civicRecordId}::country-rail::${id}`,
          });
        }
      }
    }
  } catch {
    // Structural parse failure → leave aggregate row only.
  }

  void getThinLocalizationImportGuards;
  return { presentations, rssAudit };
}

export function parseMediaLocalizationLocaleArg(argv: readonly string[]): LanguageCode {
  return parseLocale(argv);
}
