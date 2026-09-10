/**
 * Localization Authority Closure 07 — Language localization readiness contract.
 *
 * Derived from Registry + existing localization status mechanisms.
 * Does not replace Language Registry. Does not claim readiness manually.
 *
 * Permanent invariant: adding a Registry locale is an operational/data workflow,
 * not a software development task.
 */

import type { LanguageCode } from "./language.js";
import type { LanguageRegistryLocale } from "./language-registry.js";
import type { ContentTranslationSourceKind } from "./content-translation.js";

/**
 * Overall localization readiness for one Registry locale (translation path).
 * Independent of searchEnabled / seoIndexingEnabled.
 */
export type LanguageLocalizationReadinessState =
  | "DISABLED"
  | "CONFIGURED"
  | "DATA_NOT_READY"
  | "BACKFILL_REQUIRED"
  | "BACKFILL_IN_PROGRESS"
  | "READY"
  | "DEGRADED"
  | "FAILED";

export const LANGUAGE_LOCALIZATION_READINESS_STATES = [
  "DISABLED",
  "CONFIGURED",
  "DATA_NOT_READY",
  "BACKFILL_REQUIRED",
  "BACKFILL_IN_PROGRESS",
  "READY",
  "DEGRADED",
  "FAILED",
] as const satisfies readonly LanguageLocalizationReadinessState[];

export function isLanguageLocalizationReadinessState(
  value: unknown,
): value is LanguageLocalizationReadinessState {
  return (
    typeof value === "string" &&
    (LANGUAGE_LOCALIZATION_READINESS_STATES as readonly string[]).includes(value)
  );
}

/** Content-kind ownership classification for activation planning. */
export type LanguageLocalizationOwnershipClass =
  | "CT_OWNED"
  | "PLP_OWNED"
  | "PROTECTED_EXCLUDED"
  | "WEB_UI_CATALOG"
  | "NO_TRANSLATION_OWNER"
  | "NOT_TRANSLATABLE_BY_CURRENT_ARCHITECTURE";

/**
 * CT kinds eligible for historical activation backfill.
 * public_news is PLP-owned (not CT) — see LANGUAGE_ACTIVATION_PLP_OWNED_MEDIA_ENTITY_TYPES.
 */
export const LANGUAGE_ACTIVATION_CT_OWNED_KINDS = [
  "initiative",
  "discussion_comment",
  "collaborative_analysis",
  "petition",
  "improvement_proposal",
  "initiative_revision",
  "decision_session",
  "collective_decision",
  "implementation_commitment",
  "implementation_tracking",
  "official_response",
  "public_impact",
  "civic_archive",
  "blog_post",
  "civic_media",
] as const satisfies readonly ContentTranslationSourceKind[];

export type LanguageActivationCtOwnedKind =
  (typeof LANGUAGE_ACTIVATION_CT_OWNED_KINDS)[number];

/**
 * Explicitly excluded from machine translation / activation backfill.
 * Empty after Reset 01 Media correction — public_news is PLP-owned MACHINE.
 */
export const LANGUAGE_ACTIVATION_PROTECTED_EXCLUDED_KINDS = [] as const;

/**
 * Content kinds with no CT/PLP ownership under current architecture.
 * Closure 06 Knowledge debt — must stay visible, must not fake translated.
 */
export const LANGUAGE_ACTIVATION_NO_OWNER_KIND_IDS = [
  "knowledge_article",
] as const;

export type LanguageActivationNoOwnerKindId =
  (typeof LANGUAGE_ACTIVATION_NO_OWNER_KIND_IDS)[number];

/**
 * Closure 08 / Reset 01 — PLP-owned Media entity types for public /media.
 * Includes public_news carousel cards (title+summary MACHINE).
 */
export const LANGUAGE_ACTIVATION_PLP_OWNED_MEDIA_ENTITY_TYPES = [
  "civic_media_editorial",
  "civic_media_principle",
  "civic_media_trusted",
  "civic_media_fact_check",
  "civic_media_propaganda",
  "public_news",
] as const;

export type LanguageActivationPlpOwnedMediaEntityType =
  (typeof LANGUAGE_ACTIVATION_PLP_OWNED_MEDIA_ENTITY_TYPES)[number];

/**
 * Empty after Browser-Visible Implementation 01 — Part D prose is CT-owned
 * (`improvement_proposal` with Part D field bag). No MANUAL_AUTHOR public kind.
 */
export const LANGUAGE_ACTIVATION_MANUAL_AUTHOR_PUBLIC_KINDS = [] as const;

export type LanguageLocalizationCountBucket = {
  readonly current: number;
  readonly missing: number;
  readonly stale: number;
  readonly failed: number;
  readonly pending: number;
  readonly workItemsRequired: number;
};

export type LanguageLocalizationKindStatusRow = {
  readonly kindId: string;
  readonly ownership: LanguageLocalizationOwnershipClass;
  readonly counts: LanguageLocalizationCountBucket | null;
  readonly note: string | null;
};

export type LanguageWebUiReadinessSlice = {
  readonly engineReady: true;
  readonly dataReady: boolean;
  readonly requiredKeyCount: number;
  readonly missingKeyCount: number;
  readonly emptyKeyCount: number;
  readonly englishFallbackKeyCount: number;
  readonly sampleMissingPaths: readonly string[];
};

export type LanguageControlledVocabularyReadinessSlice = {
  readonly presentationReady: boolean;
  readonly conceptsChecked: number;
  readonly conceptsWithTerminologyPreferredTerm: number;
  readonly conceptsWithWebUiFallbackOnly: number;
  readonly conceptsMissingLocalizedLabel: number;
  readonly missingPreferredTermGaps: readonly string[];
};

export type LanguageHigherAuthorityReadinessSlice = {
  readonly brandPublished: boolean | null;
  readonly legalPublished: boolean | null;
  readonly note: string | null;
};

export type LanguageLocalizationReadinessReport = {
  readonly pack: "closure07";
  readonly locale: LanguageRegistryLocale;
  readonly languageId: string | null;
  readonly registry: {
    readonly enabled: boolean;
    readonly contentTranslationEnabled: boolean;
    readonly searchEnabled: boolean;
    readonly seoIndexingEnabled: boolean;
  };
  /** Registry flags allow automatic CT/PLP targeting (engine path). */
  readonly engineReady: boolean;
  /** WEB_UI + controlled vocab + owned content completeness. */
  readonly languageDataReady: boolean;
  readonly state: LanguageLocalizationReadinessState;
  readonly webUi: LanguageWebUiReadinessSlice;
  readonly controlledVocabulary: LanguageControlledVocabularyReadinessSlice;
  readonly higherAuthority: LanguageHigherAuthorityReadinessSlice;
  readonly ct: LanguageLocalizationCountBucket;
  readonly plpMedia: LanguageLocalizationCountBucket;
  readonly kindRows: readonly LanguageLocalizationKindStatusRow[];
  readonly seoReady: boolean;
  readonly searchLocalizationReady: boolean;
  readonly PROVIDER_CALLS: 0;
  readonly WRITES_PERFORMED: 0;
  readonly gaps: readonly string[];
};

/**
 * Pack 3 gate (predicate only — does not mutate seoIndexingEnabled).
 * TRUE only when localization data required for the public SEO perimeter is ready.
 */
export function isLocalizationReadyForSeo(
  report: Pick<
    LanguageLocalizationReadinessReport,
    "state" | "languageDataReady" | "engineReady"
  >,
): boolean {
  return (
    report.engineReady === true &&
    report.languageDataReady === true &&
    report.state === "READY"
  );
}

/**
 * Future Pack 4 search gate — localization ready enough that search should not
 * treat English fallback as localized content for this locale.
 */
export function isLocalizationReadyForSearch(
  report: Pick<
    LanguageLocalizationReadinessReport,
    "state" | "languageDataReady" | "engineReady"
  >,
): boolean {
  return isLocalizationReadyForSeo(report);
}

export function emptyLanguageLocalizationCountBucket(): LanguageLocalizationCountBucket {
  return {
    current: 0,
    missing: 0,
    stale: 0,
    failed: 0,
    pending: 0,
    workItemsRequired: 0,
  };
}

/**
 * Derive overall readiness from Registry + measured slices (pure).
 * Knowledge / no-owner kinds do not block READY.
 */
export function deriveLanguageLocalizationReadinessState(input: {
  readonly enabled: boolean;
  readonly contentTranslationEnabled: boolean;
  readonly webUiDataReady: boolean;
  readonly controlledVocabularyPresentationReady: boolean;
  readonly ct: LanguageLocalizationCountBucket;
  readonly plpMedia: LanguageLocalizationCountBucket;
}): LanguageLocalizationReadinessState {
  if (!input.enabled || !input.contentTranslationEnabled) {
    return "DISABLED";
  }

  if (!input.webUiDataReady || !input.controlledVocabularyPresentationReady) {
    return "DATA_NOT_READY";
  }

  const work =
    input.ct.workItemsRequired + input.plpMedia.workItemsRequired;
  const pending = input.ct.pending + input.plpMedia.pending;
  const failed = input.ct.failed + input.plpMedia.failed;
  const current = input.ct.current + input.plpMedia.current;
  const incomplete =
    input.ct.missing +
    input.ct.stale +
    input.plpMedia.missing +
    input.plpMedia.stale;

  if (pending > 0 && work > 0) {
    return "BACKFILL_IN_PROGRESS";
  }
  if (failed > 0 && current > 0 && incomplete === 0) {
    return "DEGRADED";
  }
  if (failed > 0 && current === 0 && incomplete === 0 && work === 0) {
    return "FAILED";
  }
  if (incomplete > 0 || work > 0) {
    return "BACKFILL_REQUIRED";
  }
  if (current > 0 || (work === 0 && incomplete === 0 && failed === 0)) {
    return "READY";
  }
  return "CONFIGURED";
}

export type LanguageHistoricalBackfillPlanItem = {
  readonly owner: "CT" | "PLP";
  readonly kindId: string;
  readonly locale: LanguageCode | LanguageRegistryLocale;
  readonly workItemsRequired: number;
  readonly missing: number;
  readonly stale: number;
  readonly failed: number;
  readonly current: number;
  readonly action:
    | "enqueue_ct_warm"
    | "enqueue_plp_editorial"
    | "enqueue_plp_carousel"
    | "skip_excluded"
    | "skip_no_owner"
    | "skip_current";
};

export type LanguageHistoricalBackfillPlan = {
  readonly pack: "closure07";
  readonly locale: LanguageRegistryLocale;
  readonly mode: "dry-run" | "execute";
  readonly registryEligible: boolean;
  readonly items: readonly LanguageHistoricalBackfillPlanItem[];
  readonly excluded: readonly {
    readonly kindId: string;
    readonly reason: string;
  }[];
  readonly summary: {
    readonly ctWorkItems: number;
    readonly plpWorkItems: number;
    readonly skippedCurrent: number;
  };
  readonly PROVIDER_CALLS: 0;
  readonly WRITES_PERFORMED: 0;
};
