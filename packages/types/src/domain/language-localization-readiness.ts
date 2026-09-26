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
import {
  isSeoIndexableLanguage,
  type LanguageRegistryLocale,
} from "./language-registry.js";
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

/**
 * STEP 15D.14.B.2 — PLP-owned public Participant presentation (biography /
 * public free-text skills). Distinct from Media PLP; readiness data may
 * project this slice without Admin UI redesign (Gate F).
 */
export const LANGUAGE_ACTIVATION_PLP_OWNED_PARTICIPANT_ENTITY_TYPES = [
  "participant_public",
] as const;

export type LanguageActivationPlpOwnedParticipantEntityType =
  (typeof LANGUAGE_ACTIVATION_PLP_OWNED_PARTICIPANT_ENTITY_TYPES)[number];

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
  /**
   * Gate B — identity-current but not presentation-eligible (e.g. deterministic
   * placeholder). Counts as reconciliation work, never as localized CURRENT.
   */
  readonly invalid: number;
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
  /** Controlled conceptIds with neither preferredTerm nor WEB_UI fallback. */
  readonly missingLocalizedLabelConceptIds: readonly string[];
  readonly missingPreferredTermGaps: readonly string[];
};

export type LanguageHigherAuthorityReadinessSlice = {
  readonly brandPublished: boolean | null;
  readonly legalPublished: boolean | null;
  readonly note: string | null;
};

/**
 * PWA civic persisted-reading readiness (Pack 02).
 * Distinct from Closure 07 overall READY (WEB_UI / CV / Brand / Legal).
 */
export type PwaCivicReadinessStatus =
  | "DISABLED"
  | "BACKFILL_REQUIRED"
  | "BACKFILL_IN_PROGRESS"
  | "READY"
  | "DEGRADED"
  | "FAILED";

export const PWA_CIVIC_READINESS_STATUSES = [
  "DISABLED",
  "BACKFILL_REQUIRED",
  "BACKFILL_IN_PROGRESS",
  "READY",
  "DEGRADED",
  "FAILED",
] as const satisfies readonly PwaCivicReadinessStatus[];

export function isPwaCivicReadinessStatus(value: unknown): value is PwaCivicReadinessStatus {
  return (
    typeof value === "string" &&
    (PWA_CIVIC_READINESS_STATUSES as readonly string[]).includes(value)
  );
}

export type PwaCivicCoverageScalars = {
  readonly current: number;
  readonly missing: number;
  readonly stale: number;
  /** Gate B — identity-current placeholders; reconciliation work, not coverage. */
  readonly invalid?: number;
  readonly failed: number;
  readonly pending: number;
  readonly workItemsRequired: number;
  readonly measuredKindCount: number;
  readonly unmeasuredKindCount: number;
  /**
   * `complete` — every PWA-civic kind was measured.
   * `partial_unmeasured` — some kinds remain UNKNOWN (never reported as 100%).
   */
  readonly coverageMeasurement: "complete" | "partial_unmeasured";
};

export type LanguagePwaCivicReadinessSlice = {
  readonly pwaPersistedReadingEnabled: boolean;
  readonly pwaPersistedReadingReady: boolean;
  readonly pwaCivicReadinessStatus: PwaCivicReadinessStatus;
  readonly coverage: PwaCivicCoverageScalars;
  /**
   * Pack 02 READY = bounded ordinary civic **presentation-coverage** for the
   * target locale (eligible presentation identities vs CURRENT rows). Not
   * character volume, WEB_UI/Brand/Legal/Glossary completeness, or guaranteed
   * live sourceVersion-perfect readiness.
   */
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
    readonly pwaPersistedReadingEnabled: boolean;
  };
  /** Registry flags allow automatic CT/PLP targeting (engine path). */
  readonly engineReady: boolean;
  /** WEB_UI (public + participant) + controlled vocab + owned content completeness. */
  readonly languageDataReady: boolean;
  readonly state: LanguageLocalizationReadinessState;
  /** Public-reader WEB_UI readiness (`isPublicReaderWebUiRequiredPath`). */
  readonly webUi: LanguageWebUiReadinessSlice;
  /** Participant WEB_UI readiness (`isParticipantWebUiRequiredPath`). Step 15D.2. */
  readonly participantWebUi: LanguageWebUiReadinessSlice;
  readonly controlledVocabulary: LanguageControlledVocabularyReadinessSlice;
  readonly higherAuthority: LanguageHigherAuthorityReadinessSlice;
  /** Pack 02 — PWA civic persisted-reading slice (does not require WEB_UI/CV/Brand/Legal). */
  readonly pwaCivic: LanguagePwaCivicReadinessSlice;
  readonly ct: LanguageLocalizationCountBucket;
  readonly plpMedia: LanguageLocalizationCountBucket;
  /**
   * STEP 15D.14.B.2 — participant_public PLP completeness (biography / public
   * skills). Data for Gate F; does not alone flip Closure 07 READY.
   * Optional on legacy fixtures; evaluator always populates.
   */
  readonly plpParticipant?: LanguageLocalizationCountBucket;
  readonly kindRows: readonly LanguageLocalizationKindStatusRow[];
  readonly seoReady: boolean;
  readonly searchLocalizationReady: boolean;
  readonly PROVIDER_CALLS: 0;
  readonly WRITES_PERFORMED: 0;
  readonly gaps: readonly string[];
};

/**
 * Step 07B.2 — SEO readiness means Registry SEO eligibility (predicate only).
 * Does not mutate `seoIndexingEnabled`.
 *
 * Aligns with public runtime Pack 02I / 07C–07F via `isSeoIndexableLanguage`:
 * `enabled === true && seoIndexingEnabled === true`.
 *
 * Does NOT require: engineReady, languageDataReady, state READY, WEB_UI / CT /
 * PLP completeness, provider completion, or searchEnabled.
 * Extended Localization readiness remains a separate Admin/inspection concern.
 */
export function isLocalizationReadyForSeo(
  report: Pick<LanguageLocalizationReadinessReport, "registry">,
): boolean {
  return isSeoIndexableLanguage({
    enabled: report.registry.enabled === true,
    seoIndexingEnabled: report.registry.seoIndexingEnabled === true,
  });
}

/**
 * Simplification Step 06A — Search localization readiness (predicate only).
 * Does not mutate `searchEnabled`.
 *
 * TRUE when the Registry locale is enabled for participant presentation.
 * Actual multilingual Search participation still requires Admin `searchEnabled`
 * (separate Registry flag). Runtime Search uses current non-stale CT enrichments
 * when present and always keeps canonical English fallback.
 *
 * Does NOT require: full WEB_UI completion, Controlled Vocabulary readiness,
 * full lifecycle CT/PLP completion, legacy `languageDataReady`, readiness
 * state `READY`, or SEO readiness.
 */
export function isLocalizationReadyForSearch(
  report: Pick<LanguageLocalizationReadinessReport, "registry">,
): boolean {
  return report.registry.enabled === true;
}

export function emptyLanguageLocalizationCountBucket(): LanguageLocalizationCountBucket {
  return {
    current: 0,
    missing: 0,
    stale: 0,
    invalid: 0,
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
  /** Step 15D.2 — Participant interface; defaults true when omitted (legacy callers). */
  readonly participantWebUiDataReady?: boolean;
  readonly controlledVocabularyPresentationReady: boolean;
  readonly ct: LanguageLocalizationCountBucket;
  readonly plpMedia: LanguageLocalizationCountBucket;
}): LanguageLocalizationReadinessState {
  if (!input.enabled || !input.contentTranslationEnabled) {
    return "DISABLED";
  }

  const participantReady = input.participantWebUiDataReady !== false;
  if (
    !input.webUiDataReady ||
    !participantReady ||
    !input.controlledVocabularyPresentationReady
  ) {
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
    input.ct.invalid +
    input.plpMedia.missing +
    input.plpMedia.stale +
    input.plpMedia.invalid;

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
  if (pending > 0) {
    return "BACKFILL_REQUIRED";
  }
  if (current > 0 || (work === 0 && incomplete === 0 && failed === 0)) {
    return "READY";
  }
  return "CONFIGURED";
}

/**
 * Derive PWA civic readiness from Registry gates + bounded civic coverage.
 * Does not require WEB_UI, Controlled Vocabulary, Brand, or Legal completeness.
 *
 * Safe activation:
 * - `coverageMeasurement: "partial_unmeasured"` never becomes READY
 *   (UNKNOWN must not be reported as complete).
 * - READY → DEGRADED when measured CURRENT exists alongside new missing/stale work.
 */
export function derivePwaCivicReadinessState(input: {
  readonly enabled: boolean;
  readonly contentTranslationEnabled: boolean;
  readonly pwaPersistedReadingEnabled: boolean;
  readonly coverage: PwaCivicCoverageScalars;
}): PwaCivicReadinessStatus {
  if (
    !input.enabled ||
    !input.contentTranslationEnabled ||
    !input.pwaPersistedReadingEnabled
  ) {
    return "DISABLED";
  }

  const { coverage } = input;
  const incomplete =
    coverage.missing + coverage.stale + (coverage.invalid ?? 0);
  const pending = coverage.pending;
  const failed = coverage.failed;
  const current = coverage.current;
  const work = coverage.workItemsRequired;

  if (pending > 0 && work > 0) {
    return "BACKFILL_IN_PROGRESS";
  }
  if (failed > 0 && current === 0 && incomplete === 0 && work === 0) {
    return "FAILED";
  }
  // Honest: unmeasured kinds in scope must not become READY.
  if (coverage.coverageMeasurement === "partial_unmeasured" || coverage.unmeasuredKindCount > 0) {
    if (current > 0 && incomplete === 0) {
      return "DEGRADED";
    }
    return "BACKFILL_REQUIRED";
  }
  if (failed > 0 && current > 0 && incomplete === 0) {
    return "DEGRADED";
  }
  if (incomplete > 0 || work > 0) {
    if (current > 0 && incomplete > 0) {
      return "DEGRADED";
    }
    return "BACKFILL_REQUIRED";
  }
  if (incomplete === 0 && failed === 0 && pending === 0) {
    return "READY";
  }
  return "BACKFILL_REQUIRED";
}

export function emptyPwaCivicCoverageScalars(): PwaCivicCoverageScalars {
  return {
    ...emptyLanguageLocalizationCountBucket(),
    measuredKindCount: 0,
    unmeasuredKindCount: 0,
    coverageMeasurement: "partial_unmeasured",
  };
}

export function buildLanguagePwaCivicReadinessSlice(input: {
  readonly pwaPersistedReadingEnabled: boolean;
  readonly coverage: PwaCivicCoverageScalars;
  readonly enabled: boolean;
  readonly contentTranslationEnabled: boolean;
  readonly note?: string | null;
}): LanguagePwaCivicReadinessSlice {
  const pwaCivicReadinessStatus = derivePwaCivicReadinessState({
    enabled: input.enabled,
    contentTranslationEnabled: input.contentTranslationEnabled,
    pwaPersistedReadingEnabled: input.pwaPersistedReadingEnabled,
    coverage: input.coverage,
  });
  return {
    pwaPersistedReadingEnabled: input.pwaPersistedReadingEnabled,
    pwaPersistedReadingReady: pwaCivicReadinessStatus === "READY",
    pwaCivicReadinessStatus,
    coverage: input.coverage,
    note:
      input.note ??
      "PWA civic live sourceVersion coverage: CURRENT, actionable missing/stale, and blocked current-version failures are counted separately. Historical stale rows are not work when the exact live sourceVersion is CURRENT. Ignores WEB_UI / Brand / Legal / Glossary. Missing CURRENT falls back to canonical per artifact. public_news excluded. Not a provider call.",
  };
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
