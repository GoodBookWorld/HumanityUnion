/**
 * Pack 02 — bounded-memory PWA civic localization coverage.
 *
 * Production readiness/activation path replacement for hydrate-heavy
 * `auditPublicLocalizationCorpus` polling. Mongo aggregations / scalar counts
 * only; sequential sourceKind processing; no corpus Maps; no workItems[] /
 * candidates[] accumulation; no translated prose returned to Node; no provider;
 * no warm/backfill; no Mongo writes.
 *
 * Patterns adapted from diagnose-staging-ct-coverage-light (domain service,
 * not a diagnostic script call).
 */

import type { Document } from "mongodb";

import {
  emptyLanguageLocalizationCountBucket,
  emptyPwaCivicCoverageScalars,
  type ContentTranslationSourceKind,
  type LanguageLocalizationCountBucket,
  type PwaCivicCoverageScalars,
} from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import { CONTENT_TRANSLATION_FIELD_ALLOWLIST } from "../content-translation-eligibility.js";
import {
  classifyMediaEditorialLocalizationForLocale,
  type MediaHuLocalizationIntegrityStatus,
} from "../media-hu-localization-integrity.js";
import { isLanguageRegistryMemoryAdapterActive } from "../language-registry/language-registry.repository.js";

/** PWA civic CT kinds measurable via flat bounded aggregation. */
export const PWA_CIVIC_BOUNDED_CT_KINDS = [
  "initiative",
  "collaborative_analysis",
  "blog_post",
  "discussion_comment",
  "official_response",
] as const satisfies readonly ContentTranslationSourceKind[];

export type PwaCivicBoundedCtKind = (typeof PWA_CIVIC_BOUNDED_CT_KINDS)[number];

type BoundedKindMeasurePlan = {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly status: "measured" | "UNMEASURED";
  readonly collectionName?: string;
  readonly match?: Document;
  readonly allowlistedFields?: readonly string[];
  readonly reason?: string;
};

export type PwaCivicKindCoverageRow = {
  readonly kindId: string;
  readonly ownership: "CT_OWNED" | "PLP_OWNED";
  readonly status: "measured" | "UNMEASURED";
  readonly counts: LanguageLocalizationCountBucket | null;
  readonly reason: string | null;
};

export type BoundedPwaCivicCoverageReport = {
  readonly locale: string;
  readonly coverage: PwaCivicCoverageScalars;
  readonly kindRows: readonly PwaCivicKindCoverageRow[];
  readonly ct: LanguageLocalizationCountBucket;
  readonly plpMedia: LanguageLocalizationCountBucket;
  readonly PROVIDER_CALLS: 0;
  readonly WRITES_PERFORMED: 0;
  readonly usedFullCorpusHydrate: false;
};

export type BoundedPwaCivicCoverageDeps = {
  readonly isMongoReady?: () => boolean;
  readonly aggregate?: (
    collectionName: string,
    pipeline: Document[],
  ) => Promise<Document[]>;
  readonly classifyMediaEditorial?: typeof classifyMediaEditorialLocalizationForLocale;
  /** Injected coverage for unit tests (skips Mongo). */
  readonly coverageOverride?: BoundedPwaCivicCoverageReport;
};

let depsOverrideForTests: BoundedPwaCivicCoverageDeps | null = null;

export function setBoundedPwaCivicCoverageDepsForTests(
  deps: BoundedPwaCivicCoverageDeps | null,
): void {
  depsOverrideForTests = deps;
}

function computeApproximateMissing(input: {
  readonly canonicalEligible: number;
  readonly current: number;
}): number {
  return Math.max(0, input.canonicalEligible - input.current);
}

function mongoStringFieldCharLen(fieldPath: string): Document {
  return {
    $cond: [
      { $eq: [{ $type: fieldPath }, "string"] },
      { $strLenCP: fieldPath },
      0,
    ],
  };
}

function mongoSumAllowlistedFieldChars(fields: readonly string[]): Document | number {
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

/** CT status counts — grouped scalars only (never translatedContent). */
export function buildPwaCivicCtStatusCountsPipeline(
  targetLanguages: readonly string[],
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
                        $and: [
                          { $eq: ["$freshness", "current"] },
                          { $ne: ["$stale", true] },
                        ],
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
      },
    },
    {
      $project: {
        _id: 0,
        targetLanguage: "$_id.targetLanguage",
        sourceKind: "$_id.sourceKind",
        current: 1,
        stale: 1,
      },
    },
  ];
}

export function buildPwaCivicCanonicalEligiblePipeline(input: {
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

function plpBucketFromStatus(
  status: MediaHuLocalizationIntegrityStatus,
): LanguageLocalizationCountBucket {
  const empty = emptyLanguageLocalizationCountBucket();
  switch (status) {
    case "CURRENT_PUBLISHED_COMPLETE":
      return { ...empty, current: 1 };
    case "MISSING":
      return { ...empty, missing: 1, workItemsRequired: 1 };
    case "STALE":
      return { ...empty, stale: 1, workItemsRequired: 1 };
    case "FAILED":
      return { ...empty, failed: 1, workItemsRequired: 1 };
    case "PENDING":
      return { ...empty, pending: 1, workItemsRequired: 1 };
    default:
      return empty;
  }
}

export function buildPwaCivicBoundedMeasurePlans(): readonly BoundedKindMeasurePlan[] {
  const plans: BoundedKindMeasurePlan[] = [];

  for (const sourceKind of PWA_CIVIC_BOUNDED_CT_KINDS) {
    const fields = CONTENT_TRANSLATION_FIELD_ALLOWLIST[sourceKind];
    if (!fields?.length) {
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

    plans.push({
      sourceKind,
      status: "UNMEASURED",
      reason: `No bounded measure plan for ${sourceKind}.`,
    });
  }

  return plans;
}

async function defaultAggregate(
  collectionName: string,
  pipeline: Document[],
): Promise<Document[]> {
  const collection = getMongoCollection(collectionName);
  return collection.aggregate(pipeline, { allowDiskUse: false }).toArray();
}

function sumBuckets(
  rows: readonly LanguageLocalizationCountBucket[],
): LanguageLocalizationCountBucket {
  let current = 0;
  let missing = 0;
  let stale = 0;
  let failed = 0;
  let pending = 0;
  let workItemsRequired = 0;
  for (const row of rows) {
    current += row.current;
    missing += row.missing;
    stale += row.stale;
    failed += row.failed;
    pending += row.pending;
    workItemsRequired += row.workItemsRequired;
  }
  return { current, missing, stale, failed, pending, workItemsRequired };
}

/**
 * Measure PWA civic CURRENT coverage for one locale.
 * Never hydrates full localization corpus. Never writes. Never calls providers.
 */
export async function measureBoundedPwaCivicCoverage(input: {
  readonly locale: string;
  readonly deps?: BoundedPwaCivicCoverageDeps;
}): Promise<BoundedPwaCivicCoverageReport> {
  const locale = input.locale.trim();
  const deps = { ...(depsOverrideForTests ?? {}), ...(input.deps ?? {}) };

  if (deps.coverageOverride) {
    return deps.coverageOverride;
  }

  const mongoReady =
    deps.isMongoReady ??
    (() => isMongoConfigured() && !isLanguageRegistryMemoryAdapterActive());
  const aggregate = deps.aggregate ?? defaultAggregate;
  const classifyMedia =
    deps.classifyMediaEditorial ?? classifyMediaEditorialLocalizationForLocale;

  if (!mongoReady()) {
    const coverage = emptyPwaCivicCoverageScalars();
    return {
      locale,
      coverage: {
        ...coverage,
        unmeasuredKindCount: PWA_CIVIC_BOUNDED_CT_KINDS.length + 1,
        coverageMeasurement: "partial_unmeasured",
      },
      kindRows: [
        ...PWA_CIVIC_BOUNDED_CT_KINDS.map((kindId) => ({
          kindId,
          ownership: "CT_OWNED" as const,
          status: "UNMEASURED" as const,
          counts: null,
          reason: "Mongo not configured — cannot measure CURRENT coverage.",
        })),
        {
          kindId: "civic_media_editorial",
          ownership: "PLP_OWNED" as const,
          status: "UNMEASURED" as const,
          counts: null,
          reason: "Mongo not configured — cannot measure PLP editorial.",
        },
      ],
      ct: emptyLanguageLocalizationCountBucket(),
      plpMedia: emptyLanguageLocalizationCountBucket(),
      PROVIDER_CALLS: 0,
      WRITES_PERFORMED: 0,
      usedFullCorpusHydrate: false,
    };
  }

  try {
    return await measureBoundedPwaCivicCoverageConnected({
      locale,
      aggregate,
      classifyMedia,
    });
  } catch {
    const coverage = emptyPwaCivicCoverageScalars();
    return {
      locale,
      coverage: {
        ...coverage,
        unmeasuredKindCount: PWA_CIVIC_BOUNDED_CT_KINDS.length + 1,
        coverageMeasurement: "partial_unmeasured",
      },
      kindRows: [
        ...PWA_CIVIC_BOUNDED_CT_KINDS.map((kindId) => ({
          kindId,
          ownership: "CT_OWNED" as const,
          status: "UNMEASURED" as const,
          counts: null,
          reason: "Bounded coverage measurement failed — treating as UNMEASURED.",
        })),
        {
          kindId: "civic_media_editorial",
          ownership: "PLP_OWNED" as const,
          status: "UNMEASURED" as const,
          counts: null,
          reason: "Bounded coverage measurement failed — treating as UNMEASURED.",
        },
      ],
      ct: emptyLanguageLocalizationCountBucket(),
      plpMedia: emptyLanguageLocalizationCountBucket(),
      PROVIDER_CALLS: 0,
      WRITES_PERFORMED: 0,
      usedFullCorpusHydrate: false,
    };
  }
}

async function measureBoundedPwaCivicCoverageConnected(input: {
  readonly locale: string;
  readonly aggregate: (
    collectionName: string,
    pipeline: Document[],
  ) => Promise<Document[]>;
  readonly classifyMedia: typeof classifyMediaEditorialLocalizationForLocale;
}): Promise<BoundedPwaCivicCoverageReport> {
  const { locale, aggregate, classifyMedia } = input;

  const plans = buildPwaCivicBoundedMeasurePlans();
  const ctStatusRows = await aggregate(
    MONGO_COLLECTIONS.contentTranslations,
    buildPwaCivicCtStatusCountsPipeline([locale]),
  );

  const kindRows: PwaCivicKindCoverageRow[] = [];
  const ctBuckets: LanguageLocalizationCountBucket[] = [];
  let measuredKindCount = 0;
  let unmeasuredKindCount = 0;

  // Sequential sourceKind processing — no multi-kind hydrate.
  for (const plan of plans) {
    if (plan.status === "UNMEASURED" || !plan.collectionName || !plan.match) {
      unmeasuredKindCount += 1;
      kindRows.push({
        kindId: plan.sourceKind,
        ownership: "CT_OWNED",
        status: "UNMEASURED",
        counts: null,
        reason: plan.reason ?? "UNMEASURED",
      });
      continue;
    }

    const eligibleDocs = await aggregate(
      plan.collectionName,
      buildPwaCivicCanonicalEligiblePipeline({
        match: plan.match,
        allowlistedFields: plan.allowlistedFields ?? [],
      }),
    );
    const eligibleRecords =
      typeof eligibleDocs[0]?.eligibleRecords === "number"
        ? eligibleDocs[0].eligibleRecords
        : 0;

    const status = ctStatusRows.find(
      (row) =>
        row.targetLanguage === locale && row.sourceKind === plan.sourceKind,
    );
    const current = typeof status?.current === "number" ? status.current : 0;
    const stale = typeof status?.stale === "number" ? status.stale : 0;
    const missing = computeApproximateMissing({
      canonicalEligible: eligibleRecords,
      current,
    });
    const counts: LanguageLocalizationCountBucket = {
      current,
      missing,
      stale,
      failed: 0,
      pending: 0,
      workItemsRequired: missing + stale,
    };
    ctBuckets.push(counts);
    measuredKindCount += 1;
    kindRows.push({
      kindId: plan.sourceKind,
      ownership: "CT_OWNED",
      status: "measured",
      counts,
      reason: null,
    });
  }

  let plpMedia = emptyLanguageLocalizationCountBucket();
  try {
    const mediaStatus = await classifyMedia(locale);
    plpMedia = plpBucketFromStatus(mediaStatus);
    measuredKindCount += 1;
    kindRows.push({
      kindId: "civic_media_editorial",
      ownership: "PLP_OWNED",
      status: "measured",
      counts: plpMedia,
      reason: null,
    });
  } catch {
    unmeasuredKindCount += 1;
    kindRows.push({
      kindId: "civic_media_editorial",
      ownership: "PLP_OWNED",
      status: "UNMEASURED",
      counts: null,
      reason: "PLP editorial integrity classification failed.",
    });
  }

  const ct = sumBuckets(ctBuckets);
  const coverage: PwaCivicCoverageScalars = {
    current: ct.current + plpMedia.current,
    missing: ct.missing + plpMedia.missing,
    stale: ct.stale + plpMedia.stale,
    failed: ct.failed + plpMedia.failed,
    pending: ct.pending + plpMedia.pending,
    workItemsRequired: ct.workItemsRequired + plpMedia.workItemsRequired,
    measuredKindCount,
    unmeasuredKindCount,
    coverageMeasurement:
      unmeasuredKindCount === 0 ? "complete" : "partial_unmeasured",
  };

  return {
    locale,
    coverage,
    kindRows,
    ct,
    plpMedia,
    PROVIDER_CALLS: 0,
    WRITES_PERFORMED: 0,
    usedFullCorpusHydrate: false,
  };
}
