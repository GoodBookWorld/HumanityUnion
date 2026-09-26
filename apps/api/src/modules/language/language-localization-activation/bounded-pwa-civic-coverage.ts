/**
 * Pack 02 — bounded-memory PWA civic localization coverage.
 *
 * Operational CT work remaining is the live residual identity classifier:
 * discoverStagingInitiativePathWarmSources + loadTranslatableSource +
 * buildPublicLocalizationRetryPreflight. Counts are exact current sourceVersion
 * identities, not eligible-document arithmetic. Historical stale rows are not
 * work when the live sourceVersion is already CURRENT.
 *
 * PLP editorial coverage stays a separate measured slice.
 * Never hydrates localization corpus Maps/workItems; no provider/warm/write;
 * no translated prose returned to Node merely to count it.
 *
 * public_news is permanently excluded from this corpus (visible RSS ordinary
 * reading stays source/original).
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
import {
  classifyMediaEditorialLocalizationForLocale,
  type MediaHuLocalizationIntegrityStatus,
} from "../media-hu-localization-integrity.js";
import { isLanguageRegistryMemoryAdapterActive } from "../language-registry/language-registry.repository.js";
import {
  measureLiveActivationCtCoverage,
  type LiveActivationCtCoverage,
} from "../live-residual-ct-coverage.js";

/**
 * Full ordinary-reading PWA civic CT readiness corpus (presentation identities).
 * Excludes public_news. civic_media editorial is measured via PLP separately.
 */
export const PWA_CIVIC_BOUNDED_CT_KINDS = [
  "initiative",
  "discussion_comment",
  "collaborative_analysis",
  "improvement_proposal",
  "petition",
  "initiative_revision",
  "decision_session",
  "collective_decision",
  "implementation_commitment",
  "implementation_tracking",
  "official_response",
  "public_impact",
  "civic_archive",
  "blog_post",
] as const satisfies readonly ContentTranslationSourceKind[];

export type PwaCivicBoundedCtKind = (typeof PWA_CIVIC_BOUNDED_CT_KINDS)[number];

/** Proposal statuses counted by warm Part D discovery / extractPublicImprovementProposalIds. */
export const PWA_CIVIC_IMPROVEMENT_PROPOSAL_PUBLIC_STATUSES = [
  "published",
  "included_in_revision",
  "keep_for_later",
  "not_applicable",
] as const;

type BoundedKindMeasurePlan = {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly status: "measured" | "UNMEASURED";
  readonly collectionName?: string;
  /**
   * `documents` — count matching docs as presentation identities.
   * `improvement_proposal_unwind` — published collections × public proposalIds.
   */
  readonly identityMode?: "documents" | "improvement_proposal_unwind";
  readonly match?: Document;
  readonly reason?: string;
  readonly eligibilityNote?: string;
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
  /** Explicit Pack 02 readiness model marker. */
  readonly readinessModel: "presentation_coverage";
};

export type BoundedPwaCivicCoverageDeps = {
  readonly isMongoReady?: () => boolean;
  readonly aggregate?: (
    collectionName: string,
    pipeline: Document[],
  ) => Promise<Document[]>;
  readonly classifyMediaEditorial?: typeof classifyMediaEditorialLocalizationForLocale;
  /**
   * Injected live CT classifier for unit tests. Production uses
   * measureLiveActivationCtCoverage (discovery + preflight, read-only).
   */
  readonly measureLiveCt?: (input: {
    readonly locale: string;
  }) => Promise<LiveActivationCtCoverage>;
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
                $and: [
                  { $eq: ["$freshness", "current"] },
                  { $ne: ["$stale", true] },
                  // Gate B — deterministic placeholders are not localized CURRENT.
                  { $ne: [{ $toLower: { $ifNull: ["$translationProvider", ""] } }, "deterministic"] },
                ],
              },
              1,
              0,
            ],
          },
        },
        invalid: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$freshness", "current"] },
                  { $ne: ["$stale", true] },
                  { $eq: [{ $toLower: { $ifNull: ["$translationProvider", ""] } }, "deterministic"] },
                ],
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
        invalid: 1,
        stale: 1,
      },
    },
  ];
}

/** Count matching documents as presentation identities (no character volume). */
export function buildPresentationIdentityCountPipeline(match: Document): Document[] {
  return [{ $match: match }, { $count: "eligibleRecords" }];
}

/**
 * Improvement Proposal presentation IDs — aligns with
 * listPublishedImprovementProposalIdsPage / extractPublicImprovementProposalIds.
 */
export function buildImprovementProposalIdentityCountPipeline(): Document[] {
  return [
    { $match: { status: "published" } },
    { $unwind: "$proposals" },
    {
      $match: {
        "proposals.status": {
          $in: [...PWA_CIVIC_IMPROVEMENT_PROPOSAL_PUBLIC_STATUSES],
        },
        "proposals.proposalId": { $type: "string", $ne: "" },
      },
    },
    { $count: "eligibleRecords" },
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

function documentPlan(
  sourceKind: ContentTranslationSourceKind,
  collectionName: string,
  match: Document,
  eligibilityNote: string,
): BoundedKindMeasurePlan {
  return {
    sourceKind,
    status: "measured",
    collectionName,
    identityMode: "documents",
    match,
    eligibilityNote,
  };
}

/**
 * Bounded presentation-identity measure plans for the full PWA civic CT corpus.
 * Eligibility predicates reuse warm/public projection rules (not character allowlists).
 */
export function buildPwaCivicBoundedMeasurePlans(): readonly BoundedKindMeasurePlan[] {
  return [
    documentPlan(
      "initiative",
      MONGO_COLLECTIONS.initiatives,
      {
        lifecyclePhase: "projected",
        "visibility.policy": "public",
      },
      "Public projected initiatives (bounded Pack 02 core).",
    ),
    documentPlan(
      "discussion_comment",
      MONGO_COLLECTIONS.initiativeComments,
      {
        status: "approved",
        deletedAt: { $exists: false },
      },
      "Approved non-deleted discussion comments.",
    ),
    documentPlan(
      "collaborative_analysis",
      MONGO_COLLECTIONS.initiativeAnalyses,
      { status: "published" },
      "Published collaborative analyses.",
    ),
    {
      sourceKind: "improvement_proposal",
      status: "measured",
      collectionName: MONGO_COLLECTIONS.initiativeImprovementProposalsCollections,
      identityMode: "improvement_proposal_unwind",
      eligibilityNote:
        "Published Part D collections × public proposal statuses (warm listPublishedImprovementProposalIdsPage).",
    },
    documentPlan(
      "petition",
      MONGO_COLLECTIONS.petitions,
      { status: { $ne: "Draft" } },
      "Non-draft petitions (CT warm discovery eligibility).",
    ),
    documentPlan(
      "initiative_revision",
      MONGO_COLLECTIONS.initiativeVersionRevisions,
      {},
      "All version revisions (warm discovery lists revisions for public initiatives; CT identity = revisionId).",
    ),
    documentPlan(
      "decision_session",
      MONGO_COLLECTIONS.decisionSessions,
      { status: { $in: ["published", "closed"] } },
      "Public decision sessions (published|closed).",
    ),
    documentPlan(
      "collective_decision",
      MONGO_COLLECTIONS.initiativeCollectiveDecisions,
      { status: { $in: ["opened", "closed", "cancelled"] } },
      "Public collective decisions (opened|closed|cancelled).",
    ),
    documentPlan(
      "implementation_commitment",
      MONGO_COLLECTIONS.initiativeImplementationCommitments,
      { status: { $in: ["published", "withdrawn", "completed"] } },
      "Public implementation commitments (published|withdrawn|completed).",
    ),
    documentPlan(
      "implementation_tracking",
      MONGO_COLLECTIONS.initiativeImplementationTrackings,
      { status: { $in: ["active", "completed", "archived"] } },
      "Public implementation trackings (active|completed|archived).",
    ),
    documentPlan(
      "official_response",
      MONGO_COLLECTIONS.officialResponses,
      { publicationStatus: { $ne: "draft" } },
      "Non-draft official responses (bounded Pack 02 core).",
    ),
    documentPlan(
      "public_impact",
      MONGO_COLLECTIONS.initiativePublicImpacts,
      { status: { $in: ["published", "verified", "archived"] } },
      "Public impacts (published|verified|archived).",
    ),
    documentPlan(
      "civic_archive",
      MONGO_COLLECTIONS.publicCivicArchiveRecords,
      { status: "published" },
      "Published civic archive records.",
    ),
    documentPlan(
      "blog_post",
      MONGO_COLLECTIONS.blogPosts,
      { status: "published" },
      "Published blog posts.",
    ),
  ];
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
  let invalid = 0;
  let failed = 0;
  let pending = 0;
  let workItemsRequired = 0;
  for (const row of rows) {
    current += row.current;
    missing += row.missing;
    stale += row.stale;
    invalid += row.invalid;
    failed += row.failed;
    pending += row.pending;
    workItemsRequired += row.workItemsRequired;
  }
  return { current, missing, stale, invalid, failed, pending, workItemsRequired };
}

function unmeasuredReport(locale: string, reason: string): BoundedPwaCivicCoverageReport {
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
        reason,
      })),
      {
        kindId: "civic_media_editorial",
        ownership: "PLP_OWNED" as const,
        status: "UNMEASURED" as const,
        counts: null,
        reason,
      },
    ],
    ct: emptyLanguageLocalizationCountBucket(),
    plpMedia: emptyLanguageLocalizationCountBucket(),
    PROVIDER_CALLS: 0,
    WRITES_PERFORMED: 0,
    usedFullCorpusHydrate: false,
    readinessModel: "presentation_coverage",
  };
}

/**
 * Measure PWA civic presentation-coverage for one locale.
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
  const classifyMedia =
    deps.classifyMediaEditorial ?? classifyMediaEditorialLocalizationForLocale;
  const measureLiveCt = deps.measureLiveCt ?? measureLiveActivationCtCoverage;

  if (!mongoReady()) {
    return unmeasuredReport(
      locale,
      "Mongo not configured — cannot measure presentation coverage.",
    );
  }

  try {
    return await measureBoundedPwaCivicCoverageConnected({
      locale,
      classifyMedia,
      measureLiveCt,
    });
  } catch {
    return unmeasuredReport(
      locale,
      "Bounded coverage measurement failed — treating as UNMEASURED.",
    );
  }
}

async function measureBoundedPwaCivicCoverageConnected(input: {
  readonly locale: string;
  readonly classifyMedia: typeof classifyMediaEditorialLocalizationForLocale;
  readonly measureLiveCt: (input: {
    readonly locale: string;
  }) => Promise<LiveActivationCtCoverage>;
}): Promise<BoundedPwaCivicCoverageReport> {
  const { locale, classifyMedia, measureLiveCt } = input;
  const live = await measureLiveCt({ locale });

  const kindRows: PwaCivicKindCoverageRow[] = live.kindRows.map((row) => ({
    kindId: row.kindId,
    ownership: "CT_OWNED" as const,
    status: "measured" as const,
    counts: row.counts,
    reason: "Live sourceVersion residual classification.",
  }));
  let measuredKindCount = live.kindRows.length;
  let unmeasuredKindCount = 0;

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
      reason: "PLP HU-owned civic media editorial presentation.",
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

  const ct = live.ct;
  const coverage: PwaCivicCoverageScalars = {
    current: ct.current + plpMedia.current,
    missing: ct.missing + plpMedia.missing,
    stale: ct.stale + plpMedia.stale,
    invalid: ct.invalid + plpMedia.invalid,
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
    readinessModel: "presentation_coverage",
  };
}
