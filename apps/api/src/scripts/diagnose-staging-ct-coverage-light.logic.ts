/**
 * Lightweight CT coverage diagnostic — pure helpers (no Mongo I/O).
 *
 * Aggregation-only operational measurement for uk / ar / zh-Hant.
 * Never hydrates localization corpus, never invokes translation providers,
 * never warms/backfills, never writes Mongo.
 */

import type { ContentTranslationSourceKind } from "@hu/types";
import type { Document } from "mongodb";

import { MONGO_COLLECTIONS } from "../infrastructure/mongodb/mongo-collections.js";
import {
  CONTENT_TRANSLATION_FIELD_ALLOWLIST,
  PUBLIC_CONTENT_TRANSLATION_SOURCE_KINDS,
} from "../modules/language/content-translation-eligibility.js";

/** Staging database name required by the safety gate. */
export const CT_COVERAGE_LIGHT_REQUIRED_DATABASE = "humanity_union_staging";

/** Target languages for this bounded operational diagnostic only. */
export const CT_COVERAGE_LIGHT_TARGET_LANGUAGES = ["uk", "ar", "zh-Hant"] as const;

export type CtCoverageLightTargetLanguage =
  (typeof CT_COVERAGE_LIGHT_TARGET_LANGUAGES)[number];

export type CtTranslationRowClass = "CURRENT" | "STALE" | "OTHER";

export interface CtCoverageSafetyGateInput {
  readonly nodeEnv: string | undefined;
  readonly mongoDatabase: string | undefined;
}

export interface CtCoverageSafetyGateResult {
  readonly ok: boolean;
  readonly refusalMessage: string | null;
}

export interface CanonicalKindMeasurePlan {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly status: "measured" | "UNMEASURED";
  readonly collectionName?: string;
  readonly match?: Document;
  readonly allowlistedFields?: readonly string[];
  readonly reason?: string;
}

export interface CtCountBucket {
  readonly targetLanguage: string;
  readonly sourceKind: string;
  readonly current: number;
  readonly stale: number;
  readonly other: number;
}

export interface CtCharBucket {
  readonly targetLanguage: string;
  readonly sourceKind: string;
  readonly currentRecords: number;
  readonly translatedCharacters: number;
}

export interface CanonicalMeasureResult {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly status: "measured" | "UNMEASURED";
  readonly eligibleRecords?: number;
  readonly eligibleCharacters?: number;
  readonly reason?: string;
}

export interface CoverageRow {
  readonly targetLanguage: string;
  readonly sourceKind: string;
  readonly canonicalEligible: number;
  readonly current: number;
  readonly stale: number;
  readonly approximateMissing: number;
  readonly coveragePercent: number | null;
}

export const APPROXIMATE_MISSING_CAVEAT =
  "approximateMissing = max(0, canonicalEligible - current). Approximate when multiple CURRENT sourceVersion rows exist for the same sourceRecordId×targetLanguage.";

export function assertCtCoverageLightSafetyGate(
  input: CtCoverageSafetyGateInput,
): CtCoverageSafetyGateResult {
  if (input.nodeEnv !== "production") {
    return {
      ok: false,
      refusalMessage:
        "REFUSED: diagnose:ct-coverage-light requires NODE_ENV=production (refusing non-production).",
    };
  }

  const database = input.mongoDatabase?.trim() ?? "";
  if (database !== CT_COVERAGE_LIGHT_REQUIRED_DATABASE) {
    return {
      ok: false,
      refusalMessage: `REFUSED: diagnose:ct-coverage-light requires MONGODB_DATABASE=${CT_COVERAGE_LIGHT_REQUIRED_DATABASE} (got ${database || "(unset)"}). Never defaults to production or development databases.`,
    };
  }

  return { ok: true, refusalMessage: null };
}

export function classifyContentTranslationRow(input: {
  readonly freshness?: string;
  readonly stale?: boolean;
}): CtTranslationRowClass {
  if (input.freshness === "current" && input.stale !== true) {
    return "CURRENT";
  }
  if (input.stale === true || input.freshness === "stale") {
    return "STALE";
  }
  return "OTHER";
}

export function computeApproximateMissing(input: {
  readonly canonicalEligible: number;
  readonly current: number;
}): number {
  return Math.max(0, input.canonicalEligible - input.current);
}

export function computeCoveragePercent(input: {
  readonly canonicalEligible: number;
  readonly current: number;
}): number | null {
  if (input.canonicalEligible <= 0) {
    return null;
  }
  return Math.round((1000 * input.current) / input.canonicalEligible) / 10;
}

/** Mongo $strLenCP for a string field; non-strings contribute 0. */
export function mongoStringFieldCharLen(fieldPath: string): Document {
  return {
    $cond: [
      { $eq: [{ $type: fieldPath }, "string"] },
      { $strLenCP: fieldPath },
      0,
    ],
  };
}

export function mongoSumAllowlistedFieldChars(fields: readonly string[]): Document | number {
  if (fields.length === 0) {
    return 0;
  }
  if (fields.length === 1) {
    return mongoStringFieldCharLen(`$${fields[0]}`);
  }
  return {
    $add: fields.map((field) => mongoStringFieldCharLen(`$${field}`)),
  };
}

/**
 * CT status counts pipeline — returns only grouped scalars (no translatedContent).
 */
export function buildContentTranslationStatusCountsPipeline(
  targetLanguages: readonly string[] = CT_COVERAGE_LIGHT_TARGET_LANGUAGES,
): Document[] {
  return [
    {
      $match: {
        targetLanguage: { $in: [...targetLanguages] },
      },
    },
    {
      $group: {
        _id: {
          targetLanguage: "$targetLanguage",
          sourceKind: "$sourceKind",
        },
        current: {
          $sum: {
            $cond: [
              {
                $and: [{ $eq: ["$freshness", "current"] }, { $ne: ["$stale", true] }],
              },
              1,
              0,
            ],
          },
        },
        stale: {
          $sum: {
            $cond: [
              {
                $and: [
                  {
                    $not: [
                      {
                        $and: [{ $eq: ["$freshness", "current"] }, { $ne: ["$stale", true] }],
                      },
                    ],
                  },
                  {
                    $or: [{ $eq: ["$stale", true] }, { $eq: ["$freshness", "stale"] }],
                  },
                ],
              },
              1,
              0,
            ],
          },
        },
        other: {
          $sum: {
            $cond: [
              {
                $and: [
                  {
                    $not: [
                      {
                        $and: [{ $eq: ["$freshness", "current"] }, { $ne: ["$stale", true] }],
                      },
                    ],
                  },
                  {
                    $not: [
                      {
                        $or: [{ $eq: ["$stale", true] }, { $eq: ["$freshness", "stale"] }],
                      },
                    ],
                  },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        targetLanguage: "$_id.targetLanguage",
        sourceKind: "$_id.sourceKind",
        current: 1,
        stale: 1,
        other: 1,
      },
    },
    { $sort: { targetLanguage: 1, sourceKind: 1 } },
  ];
}

/**
 * CURRENT translated character volume — scalars only; never returns translated text.
 * Optionally restricts object keys to allowlisted fields when sourceKind is known.
 */
export function buildCurrentTranslatedCharactersPipeline(input: {
  readonly targetLanguage: string;
  readonly sourceKind?: string;
  readonly allowlistedKeys?: readonly string[];
}): Document[] {
  const match: Document = {
    targetLanguage: input.targetLanguage,
    freshness: "current",
    stale: { $ne: true },
  };
  if (input.sourceKind) {
    match.sourceKind = input.sourceKind;
  }

  const allowlistedKeys = input.allowlistedKeys ? [...input.allowlistedKeys] : null;

  const fieldEntriesExpr: Document = {
    $cond: [
      { $eq: [{ $type: "$translatedContent" }, "object"] },
      allowlistedKeys && allowlistedKeys.length > 0
        ? {
            $filter: {
              input: { $objectToArray: "$translatedContent" },
              as: "entry",
              cond: { $in: ["$$entry.k", allowlistedKeys] },
            },
          }
        : { $objectToArray: "$translatedContent" },
      [],
    ],
  };

  const objectCharsExpr: Document = {
    $reduce: {
      input: fieldEntriesExpr,
      initialValue: 0,
      in: {
        $add: [
          "$$value",
          {
            $cond: [
              { $eq: [{ $type: "$$this.v" }, "string"] },
              { $strLenCP: "$$this.v" },
              0,
            ],
          },
        ],
      },
    },
  };

  const plainStringCharsExpr: Document = {
    $cond: [
      { $eq: [{ $type: "$translatedContent" }, "string"] },
      { $strLenCP: "$translatedContent" },
      0,
    ],
  };

  return [
    { $match: match },
    {
      $project: {
        sourceKind: 1,
        translatedCharacters: {
          $add: [objectCharsExpr, plainStringCharsExpr],
        },
      },
    },
    {
      $group: {
        _id: "$sourceKind",
        currentRecords: { $sum: 1 },
        translatedCharacters: { $sum: "$translatedCharacters" },
      },
    },
    {
      $project: {
        _id: 0,
        sourceKind: "$_id",
        currentRecords: 1,
        translatedCharacters: 1,
      },
    },
    { $sort: { sourceKind: 1 } },
  ];
}

/**
 * Canonical eligible record + character aggregation for flat allowlisted string fields.
 */
export function buildCanonicalEligibleCharsPipeline(input: {
  readonly match: Document;
  readonly allowlistedFields: readonly string[];
}): Document[] {
  return [
    { $match: input.match },
    {
      $project: {
        _chars: mongoSumAllowlistedFieldChars(input.allowlistedFields),
      },
    },
    {
      $group: {
        _id: null,
        eligibleRecords: { $sum: 1 },
        eligibleCharacters: { $sum: "$_chars" },
      },
    },
    {
      $project: {
        _id: 0,
        eligibleRecords: 1,
        eligibleCharacters: 1,
      },
    },
  ];
}

/**
 * Per public sourceKind: measure via bounded aggregation where safe, else UNMEASURED.
 */
export function buildCanonicalKindMeasurePlans(): readonly CanonicalKindMeasurePlan[] {
  const plans: CanonicalKindMeasurePlan[] = [];

  for (const sourceKind of PUBLIC_CONTENT_TRANSLATION_SOURCE_KINDS) {
    const fields = CONTENT_TRANSLATION_FIELD_ALLOWLIST[sourceKind];

    if (sourceKind === "public_news") {
      plans.push({
        sourceKind,
        status: "UNMEASURED",
        reason:
          "public_news is PLP-owned; CONTENT_TRANSLATION_FIELD_ALLOWLIST is empty (not CT-eligible).",
      });
      continue;
    }

    if (fields.length === 0) {
      plans.push({
        sourceKind,
        status: "UNMEASURED",
        reason: `CONTENT_TRANSLATION_FIELD_ALLOWLIST for ${sourceKind} is empty.`,
      });
      continue;
    }

    if (sourceKind === "initiative") {
      plans.push({
        sourceKind,
        status: "measured",
        collectionName: MONGO_COLLECTIONS.initiatives,
        match: {
          lifecyclePhase: "projected",
          "visibility.policy": "public",
        },
        allowlistedFields: [...fields],
      });
      continue;
    }

    if (sourceKind === "collaborative_analysis") {
      plans.push({
        sourceKind,
        status: "measured",
        collectionName: MONGO_COLLECTIONS.initiativeAnalyses,
        match: { status: "published" },
        allowlistedFields: [...fields],
      });
      continue;
    }

    if (sourceKind === "blog_post") {
      plans.push({
        sourceKind,
        status: "measured",
        collectionName: MONGO_COLLECTIONS.blogPosts,
        match: { status: "published" },
        allowlistedFields: [...fields],
      });
      continue;
    }

    if (sourceKind === "discussion_comment") {
      plans.push({
        sourceKind,
        status: "measured",
        collectionName: MONGO_COLLECTIONS.initiativeComments,
        match: {
          status: "approved",
          deletedAt: { $exists: false },
        },
        allowlistedFields: [...fields],
      });
      continue;
    }

    if (sourceKind === "official_response") {
      plans.push({
        sourceKind,
        status: "measured",
        collectionName: MONGO_COLLECTIONS.officialResponses,
        match: { publicationStatus: { $ne: "draft" } },
        allowlistedFields: [...fields],
      });
      continue;
    }

    if (sourceKind === "petition") {
      plans.push({
        sourceKind,
        status: "UNMEASURED",
        reason:
          "Petition CT fields are nested under subject and keyArguments is an array joined in the loader; safe flat aggregation would not match CT serialization without hydrate.",
      });
      continue;
    }

    if (sourceKind === "improvement_proposal") {
      plans.push({
        sourceKind,
        status: "UNMEASURED",
        reason:
          "Requires Part D structured-proposal projection (findPublishedStructuredProposalById); not a flat collection scan.",
      });
      continue;
    }

    if (sourceKind === "initiative_revision") {
      plans.push({
        sourceKind,
        status: "UNMEASURED",
        reason:
          "Requires public revision projection + nested changes serialization; unsafe without hydrate path.",
      });
      continue;
    }

    if (sourceKind === "decision_session" || sourceKind === "collective_decision") {
      plans.push({
        sourceKind,
        status: "UNMEASURED",
        reason:
          "Allowlist includes structuredContent / projection-derived fields; accurate chars need civic loader serialization, not raw document fields.",
      });
      continue;
    }

    if (
      sourceKind === "implementation_commitment" ||
      sourceKind === "implementation_tracking"
    ) {
      plans.push({
        sourceKind,
        status: "UNMEASURED",
        reason:
          "Public eligibility and field bags come from public projections (arrays/serialized lists); unsafe without hydrate.",
      });
      continue;
    }

    if (sourceKind === "public_impact") {
      plans.push({
        sourceKind,
        status: "UNMEASURED",
        reason:
          "evidence field is stableJsonForTranslation of an array via public projection; not flat document strings.",
      });
      continue;
    }

    if (sourceKind === "civic_archive") {
      plans.push({
        sourceKind,
        status: "UNMEASURED",
        reason:
          "Allowlist maps nested lessonsLearned/knowledgeContribution/timelineLabels via public projection; flat aggregation would mis-count.",
      });
      continue;
    }

    if (sourceKind === "civic_media") {
      plans.push({
        sourceKind,
        status: "UNMEASURED",
        reason:
          "Singleton civic-media-center with nested arrays (faq, overviewPoints, stages); requires civic loader serialization.",
      });
      continue;
    }

    plans.push({
      sourceKind,
      status: "UNMEASURED",
      reason: "No bounded flat-field aggregation plan without reusing full hydration architecture.",
    });
  }

  return plans;
}

export function buildCoverageRows(input: {
  readonly counts: readonly CtCountBucket[];
  readonly canonical: readonly CanonicalMeasureResult[];
  readonly targetLanguages?: readonly string[];
}): CoverageRow[] {
  const languages = input.targetLanguages ?? CT_COVERAGE_LIGHT_TARGET_LANGUAGES;
  const measured = input.canonical.filter((row) => row.status === "measured");
  const rows: CoverageRow[] = [];

  for (const targetLanguage of languages) {
    for (const kind of measured) {
      const bucket = input.counts.find(
        (c) => c.targetLanguage === targetLanguage && c.sourceKind === kind.sourceKind,
      );
      const canonicalEligible = kind.eligibleRecords ?? 0;
      const current = bucket?.current ?? 0;
      const stale = bucket?.stale ?? 0;
      rows.push({
        targetLanguage,
        sourceKind: kind.sourceKind,
        canonicalEligible,
        current,
        stale,
        approximateMissing: computeApproximateMissing({ canonicalEligible, current }),
        coveragePercent: computeCoveragePercent({ canonicalEligible, current }),
      });
    }
  }

  return rows;
}

export function formatCtCoverageLightReport(input: {
  readonly database: string;
  readonly targetLanguages: readonly string[];
  readonly counts: readonly CtCountBucket[];
  readonly charBuckets: readonly CtCharBucket[];
  readonly canonical: readonly CanonicalMeasureResult[];
  readonly coverage: readonly CoverageRow[];
}): string {
  const lines: string[] = [];
  lines.push("=== Lightweight CT Coverage Diagnostic ===");
  lines.push(`database: ${input.database}`);
  lines.push(`targetLanguages: ${input.targetLanguages.join(", ")}`);
  lines.push("");

  lines.push("--- Content Translation counts (by targetLanguage × sourceKind) ---");
  if (input.counts.length === 0) {
    lines.push("(no content_translations rows for target languages)");
  } else {
    for (const row of input.counts) {
      lines.push(
        `${row.targetLanguage}\t${row.sourceKind}\tCURRENT=${row.current}\tSTALE=${row.stale}\tOTHER=${row.other}`,
      );
    }
  }
  lines.push("");

  lines.push("--- CURRENT translated characters (scalars only; no translated text) ---");
  if (input.charBuckets.length === 0) {
    lines.push("(no CURRENT rows)");
  } else {
    for (const row of input.charBuckets) {
      lines.push(
        `${row.targetLanguage}\t${row.sourceKind}\tCURRENT_records=${row.currentRecords}\ttranslatedCharacters=${row.translatedCharacters}`,
      );
    }
    for (const lang of input.targetLanguages) {
      const total = input.charBuckets
        .filter((b) => b.targetLanguage === lang)
        .reduce((sum, b) => sum + b.translatedCharacters, 0);
      const records = input.charBuckets
        .filter((b) => b.targetLanguage === lang)
        .reduce((sum, b) => sum + b.currentRecords, 0);
      lines.push(
        `${lang}\tTOTAL\tCURRENT_records=${records}\ttranslatedCharacters=${total}`,
      );
    }
  }
  lines.push("");

  lines.push("--- Canonical eligible (measured / UNMEASURED) ---");
  for (const row of input.canonical) {
    if (row.status === "UNMEASURED") {
      lines.push(`${row.sourceKind}\tUNMEASURED\t${row.reason ?? ""}`);
    } else {
      lines.push(
        `${row.sourceKind}\tmeasured\teligibleRecords=${row.eligibleRecords ?? 0}\teligibleCharacters=${row.eligibleCharacters ?? 0}`,
      );
    }
  }
  lines.push("");

  lines.push("--- Coverage (measured kinds only; approximateMissing caveat applies) ---");
  lines.push(APPROXIMATE_MISSING_CAVEAT);
  for (const row of input.coverage) {
    const pct =
      row.coveragePercent === null ? "n/a" : `${row.coveragePercent.toFixed(1)}%`;
    lines.push(
      `${row.targetLanguage}\t${row.sourceKind}\tcanonicalEligible=${row.canonicalEligible}\tcurrent=${row.current}\tstale=${row.stale}\tapproximateMissing=${row.approximateMissing}\tcoveragePercent=${pct}`,
    );
  }
  lines.push("");

  const measuredCanonical = input.canonical.filter((c) => c.status === "measured");
  const canonicalEligibleRecords = measuredCanonical.reduce(
    (sum, c) => sum + (c.eligibleRecords ?? 0),
    0,
  );
  const canonicalEligibleCharacters = measuredCanonical.reduce(
    (sum, c) => sum + (c.eligibleCharacters ?? 0),
    0,
  );

  lines.push("--- COST INPUT SUMMARY (scalars; no monetary prices; no Gemini APIs) ---");
  lines.push(`CANONICAL_ELIGIBLE_RECORDS=${canonicalEligibleRecords}`);
  lines.push(`CANONICAL_ELIGIBLE_CHARACTERS=${canonicalEligibleCharacters}`);
  lines.push(
    "(Canonical totals include measured kinds only; UNMEASURED kinds are excluded.)",
  );

  let totalCurrentJobs = 0;
  for (const lang of input.targetLanguages) {
    const langCounts = input.counts.filter((c) => c.targetLanguage === lang);
    const currentRecords = langCounts.reduce((sum, c) => sum + c.current, 0);
    const staleRecords = langCounts.reduce((sum, c) => sum + c.stale, 0);
    const currentChars = input.charBuckets
      .filter((b) => b.targetLanguage === lang)
      .reduce((sum, b) => sum + b.translatedCharacters, 0);
    totalCurrentJobs += currentRecords;
    lines.push(`${lang}:`);
    lines.push(`  CURRENT_TRANSLATION_RECORDS=${currentRecords}`);
    lines.push(`  CURRENT_TRANSLATED_CHARACTERS=${currentChars}`);
    lines.push(`  STALE_TRANSLATION_RECORDS=${staleRecords}`);
  }
  lines.push(`TOTAL_CURRENT_TRANSLATION_JOBS=${totalCurrentJobs}`);
  lines.push(
    "(TOTAL_CURRENT_TRANSLATION_JOBS = sum of CURRENT persisted content_translations rows for target languages.)",
  );

  return lines.join("\n");
}

/** True when a pipeline stage projects translated text into Node (forbidden). */
export function pipelineReturnsTranslatedText(pipeline: readonly Document[]): boolean {
  const serialized = JSON.stringify(pipeline);
  // Projection of the raw field as an output key (not merely referencing for $strLenCP).
  if (/"translatedContent"\s*:\s*1/.test(serialized)) {
    return true;
  }
  if (/"translatedContent"\s*:\s*"\$translatedContent"/.test(serialized)) {
    return true;
  }
  return false;
}
