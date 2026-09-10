/**
 * Closure 07 — historical backfill planner (one locale, bounded by kind).
 * Orchestrates existing corpus audit + Media PLP integrity — no second engine.
 */

import {
  LANGUAGE_ACTIVATION_CT_OWNED_KINDS,
  LANGUAGE_ACTIVATION_NO_OWNER_KIND_IDS,
  LANGUAGE_ACTIVATION_PROTECTED_EXCLUDED_KINDS,
  emptyLanguageLocalizationCountBucket,
  type LanguageCode,
  type LanguageHistoricalBackfillPlan,
  type LanguageHistoricalBackfillPlanItem,
  type LanguageLocalizationCountBucket,
} from "@hu/types";

import {
  auditPublicLocalizationCorpus,
  type PublicLocalizationCorpusAudit,
} from "../public-localization-corpus.js";
import {
  classifyMediaEditorialLocalizationForLocale,
  type MediaHuLocalizationIntegrityStatus,
} from "../media-hu-localization-integrity.js";
import {
  assessMediaCarouselPlpPresenceForLocale,
  type AssessMediaCarouselPlpPresenceInput,
} from "../assess-media-carousel-plp-presence.js";
import type { StagingWarmSourceKind } from "../content-translation-staging-warm-operator-scope.js";

function bucketFromLocaleAudit(
  audit: PublicLocalizationCorpusAudit,
  locale: string,
): LanguageLocalizationCountBucket {
  const row = audit.byLocale.find((entry) => entry.targetLanguage === locale);
  if (!row) {
    return emptyLanguageLocalizationCountBucket();
  }
  return {
    current: row.CURRENT_TARGET_TRANSLATION_IDENTITIES,
    missing: row.MISSING_TARGET_TRANSLATION_IDENTITIES,
    stale: row.STALE_TARGET_TRANSLATION_IDENTITIES,
    failed: row.FAILED_TARGET_TRANSLATION_IDENTITIES,
    pending: 0,
    workItemsRequired: row.WORK_ITEMS_REQUIRED,
  };
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

export type LanguageHistoricalBackfillPlannerDeps = {
  readonly auditCorpus?: typeof auditPublicLocalizationCorpus;
  readonly classifyMediaEditorial?: typeof classifyMediaEditorialLocalizationForLocale;
  readonly assessCarouselPlp?: (
    input: AssessMediaCarouselPlpPresenceInput,
  ) => ReturnType<typeof assessMediaCarouselPlpPresenceForLocale>;
};

/**
 * Plan historical localization work for one Registry locale.
 * Does not call TranslationProvider. Does not write.
 */
export async function planLanguageHistoricalBackfill(input: {
  readonly locale: string;
  readonly registryEligible: boolean;
  readonly mode?: "dry-run" | "execute";
  readonly deps?: LanguageHistoricalBackfillPlannerDeps;
}): Promise<LanguageHistoricalBackfillPlan> {
  const locale = input.locale.trim();
  const mode = input.mode ?? "dry-run";
  const auditCorpus = input.deps?.auditCorpus ?? auditPublicLocalizationCorpus;
  const classifyMedia =
    input.deps?.classifyMediaEditorial ?? classifyMediaEditorialLocalizationForLocale;
  const assessCarousel =
    input.deps?.assessCarouselPlp ?? assessMediaCarouselPlpPresenceForLocale;

  const excluded = [
    ...LANGUAGE_ACTIVATION_PROTECTED_EXCLUDED_KINDS.map((kindId) => ({
      kindId,
      reason: "protected_original_content",
    })),
    ...LANGUAGE_ACTIVATION_NO_OWNER_KIND_IDS.map((kindId) => ({
      kindId,
      reason: "NO_TRANSLATION_OWNER / NOT_TRANSLATABLE_BY_CURRENT_ARCHITECTURE",
    })),
    {
      kindId: "web_ui_catalog",
      reason: "WEB_UI catalogs are data readiness, not CT/PLP backfill",
    },
  ];

  const items: LanguageHistoricalBackfillPlanItem[] = [];

  if (!input.registryEligible) {
    return {
      pack: "closure07",
      locale,
      mode,
      registryEligible: false,
      items: [],
      excluded,
      summary: { ctWorkItems: 0, plpWorkItems: 0, skippedCurrent: 0 },
      PROVIDER_CALLS: 0,
      WRITES_PERFORMED: 0,
    };
  }

  let ctWorkItems = 0;
  let skippedCurrent = 0;

  // Bound discovery one kind at a time — avoid a single unbounded multi-kind hydrate.
  for (const kind of LANGUAGE_ACTIVATION_CT_OWNED_KINDS) {
    const audit = await auditCorpus({
      kinds: [kind as StagingWarmSourceKind],
      targetLocales: [locale as LanguageCode],
    });
    const counts = bucketFromLocaleAudit(audit, locale);
    const action =
      counts.workItemsRequired === 0
        ? ("skip_current" as const)
        : ("enqueue_ct_warm" as const);
    if (action === "skip_current") {
      skippedCurrent += 1;
    } else {
      ctWorkItems += counts.workItemsRequired;
    }
    items.push({
      owner: "CT",
      kindId: kind,
      locale,
      workItemsRequired: counts.workItemsRequired,
      missing: counts.missing,
      stale: counts.stale,
      failed: counts.failed,
      current: counts.current,
      action,
    });
  }

  const mediaStatus = await classifyMedia(locale);
  const plpCounts = plpBucketFromStatus(mediaStatus);
  const plpAction =
    plpCounts.workItemsRequired === 0
      ? ("skip_current" as const)
      : ("enqueue_plp_editorial" as const);
  if (plpAction === "skip_current") {
    skippedCurrent += 1;
  }
  items.push({
    owner: "PLP",
    kindId: "civic_media_editorial",
    locale,
    workItemsRequired: plpCounts.workItemsRequired,
    missing: plpCounts.missing,
    stale: plpCounts.stale,
    failed: plpCounts.failed,
    current: plpCounts.current,
    action: plpAction,
  });

  // Closure 08 — public /media carousel HU-owned discrete entity types are required.
  // public_news remains protected and is never planned as PLP machine work.
  const carousel = await assessCarousel({ locale, pageSize: 50 });
  let plpCarouselWork = 0;
  for (const entityType of [
    "civic_media_principle",
    "civic_media_trusted",
    "civic_media_fact_check",
    "civic_media_propaganda",
  ] as const) {
    const measured = carousel.byKind.find((row) => row.kindId === entityType);
    const counts = measured?.counts ?? emptyLanguageLocalizationCountBucket();
    const action =
      counts.workItemsRequired === 0
        ? ("skip_current" as const)
        : ("enqueue_plp_carousel" as const);
    if (action === "skip_current") {
      skippedCurrent += 1;
    } else {
      plpCarouselWork += counts.workItemsRequired;
    }
    items.push({
      owner: "PLP",
      kindId: entityType,
      locale,
      workItemsRequired: counts.workItemsRequired,
      missing: counts.missing,
      stale: counts.stale,
      failed: counts.failed,
      current: counts.current,
      action,
    });
  }

  return {
    pack: "closure07",
    locale,
    mode,
    registryEligible: true,
    items,
    excluded,
    summary: {
      ctWorkItems,
      plpWorkItems: plpCounts.workItemsRequired + plpCarouselWork,
      skippedCurrent,
    },
    PROVIDER_CALLS: 0,
    WRITES_PERFORMED: 0,
  };
}

export function aggregateCtCountsFromPlan(
  plan: LanguageHistoricalBackfillPlan,
): LanguageLocalizationCountBucket {
  let current = 0;
  let missing = 0;
  let stale = 0;
  let failed = 0;
  let workItemsRequired = 0;
  for (const item of plan.items) {
    if (item.owner !== "CT") continue;
    current += item.current;
    missing += item.missing;
    stale += item.stale;
    failed += item.failed;
    workItemsRequired += item.workItemsRequired;
  }
  return {
    current,
    missing,
    stale,
    failed,
    pending: 0,
    workItemsRequired,
  };
}

export function aggregatePlpCountsFromPlan(
  plan: LanguageHistoricalBackfillPlan,
): LanguageLocalizationCountBucket {
  let current = 0;
  let missing = 0;
  let stale = 0;
  let failed = 0;
  let workItemsRequired = 0;
  for (const item of plan.items) {
    if (item.owner !== "PLP") continue;
    current += item.current;
    missing += item.missing;
    stale += item.stale;
    failed += item.failed;
    workItemsRequired += item.workItemsRequired;
  }
  return {
    current,
    missing,
    stale,
    failed,
    pending: 0,
    workItemsRequired,
  };
}
