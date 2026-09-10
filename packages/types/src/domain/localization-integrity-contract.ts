/**
 * Localization Authority Closure 08 — final localization integrity contract.
 *
 * Consolidates Closure 05–07 readiness / ownership / safety into one typed
 * aggregate. Does not invent a new localization architecture layer.
 */

import type { LanguageLocalizationReadinessReport } from "./language-localization-readiness.js";
import {
  LANGUAGE_ACTIVATION_CT_OWNED_KINDS,
  LANGUAGE_ACTIVATION_MANUAL_AUTHOR_PUBLIC_KINDS,
  LANGUAGE_ACTIVATION_NO_OWNER_KIND_IDS,
  LANGUAGE_ACTIVATION_PLP_OWNED_MEDIA_ENTITY_TYPES,
  LANGUAGE_ACTIVATION_PROTECTED_EXCLUDED_KINDS,
  isLocalizationReadyForSearch,
  isLocalizationReadyForSeo,
  type LanguageLocalizationReadinessState,
} from "./language-localization-readiness.js";

/** Artifact classification for bounded integrity rows. */
export type LocalizationIntegrityArtifactState =
  | "CURRENT"
  | "MISSING"
  | "STALE"
  | "FAILED"
  | "PENDING"
  | "PROTECTED"
  | "NO_OWNER"
  /** Discovery failed / silently empty — must not be treated as CURRENT/READY. */
  | "NO_CORPUS";

export type LocalizationIntegrityArtifactRow = {
  readonly kindId: string;
  readonly ownership:
    | "CT_OWNED"
    | "PLP_OWNED"
    | "PROTECTED_EXCLUDED"
    | "WEB_UI_CATALOG"
    | "NO_TRANSLATION_OWNER"
    | "MANUAL_AUTHOR";
  readonly state: LocalizationIntegrityArtifactState;
  readonly detail: string | null;
};

export type LocalizationIntegritySafetyFlags = {
  readonly providerCalls: 0;
  readonly writesPerformed: 0;
  readonly enqueuesPerformed: 0;
  readonly publicReadSideEffectFree: true;
};

export type LocalizationIntegrityReport = {
  readonly pack: "closure08";
  readonly locale: string;
  readonly kindScope: readonly string[];
  readonly readiness: LanguageLocalizationReadinessReport;
  readonly overallStatus: LanguageLocalizationReadinessState;
  readonly artifacts: readonly LocalizationIntegrityArtifactRow[];
  readonly controlledEnglishLeakCount: number;
  readonly canonicalFallbackTruthful: boolean;
  readonly historicalBackfillRequired: boolean;
  readonly seoReady: boolean;
  readonly searchReady: boolean;
  readonly safety: LocalizationIntegritySafetyFlags;
  readonly ownershipPolicy: {
    readonly ctOwned: readonly string[];
    readonly plpOwned: readonly string[];
    readonly protectedExcluded: readonly string[];
    readonly noOwner: readonly string[];
    readonly manualAuthor: readonly string[];
    readonly mediaCarouselDecision:
      | "REQUIRED_PLP_DISCRETE_ENTITY_TYPES"
      | "EXCLUDED";
    readonly mediaCarouselNote: string;
  };
  readonly gaps: readonly string[];
  readonly blocking: boolean;
};

/**
 * Central ownership/readiness policy for Closure 08 (stable reference).
 */
export const LOCALIZATION_INTEGRITY_OWNERSHIP_POLICY = {
  ctOwned: [...LANGUAGE_ACTIVATION_CT_OWNED_KINDS],
  plpOwned: [...LANGUAGE_ACTIVATION_PLP_OWNED_MEDIA_ENTITY_TYPES],
  protectedExcluded: [...LANGUAGE_ACTIVATION_PROTECTED_EXCLUDED_KINDS],
  noOwner: [...LANGUAGE_ACTIVATION_NO_OWNER_KIND_IDS],
  manualAuthor: [...LANGUAGE_ACTIVATION_MANUAL_AUTHOR_PUBLIC_KINDS],
  mediaCarouselDecision: "REQUIRED_PLP_DISCRETE_ENTITY_TYPES" as const,
  mediaCarouselNote:
    "Public /media carousel HU-owned cards are discrete PLP entity types " +
    "(principle/trusted/fact_check/propaganda) plus editorial. " +
    "public_news carousel cards remain PROTECTED original-language. " +
    "Synthetic planner kind civic_media_carousel is an enqueue bucket, not an entityType.",
} as const;

export function buildLocalizationIntegrityReport(input: {
  readonly readiness: LanguageLocalizationReadinessReport;
  readonly kindScope: readonly string[];
  readonly artifacts?: readonly LocalizationIntegrityArtifactRow[];
  readonly controlledEnglishLeakCount?: number;
  readonly canonicalFallbackTruthful?: boolean;
  /**
   * When true, CT discovery failed or was silently empty for a kind that
   * requires corpus discovery — overall READY is forbidden (DATA_NOT_READY).
   */
  readonly corpusDiscoveryBlocked?: boolean;
}): LocalizationIntegrityReport {
  const readiness = input.readiness;
  const historicalBackfillRequired =
    readiness.state === "BACKFILL_REQUIRED" ||
    readiness.state === "BACKFILL_IN_PROGRESS" ||
    readiness.ct.workItemsRequired > 0 ||
    readiness.plpMedia.workItemsRequired > 0;

  const artifacts =
    input.artifacts ??
    ([
      ...LOCALIZATION_INTEGRITY_OWNERSHIP_POLICY.protectedExcluded.map((kindId) => ({
        kindId,
        ownership: "PROTECTED_EXCLUDED" as const,
        state: "PROTECTED" as const,
        detail: "RSS / protected original — never machine-translated",
      })),
      ...LOCALIZATION_INTEGRITY_OWNERSHIP_POLICY.noOwner.map((kindId) => ({
        kindId,
        ownership: "NO_TRANSLATION_OWNER" as const,
        state: "NO_OWNER" as const,
        detail:
          "NOT_TRANSLATABLE_BY_CURRENT_ARCHITECTURE — does not block READY under current policy",
      })),
      ...LOCALIZATION_INTEGRITY_OWNERSHIP_POLICY.manualAuthor.map((kindId) => ({
        kindId,
        ownership: "MANUAL_AUTHOR" as const,
        state: "CURRENT" as const,
        detail: "Closure 04 Part D — MANUAL_AUTHOR; not Cap02 CT chrome",
      })),
    ] as const);

  const gaps = [...readiness.gaps];
  if ((input.controlledEnglishLeakCount ?? 0) > 0) {
    gaps.push(
      `Controlled English leakage findings: ${input.controlledEnglishLeakCount}`,
    );
  }
  if (input.canonicalFallbackTruthful === false) {
    gaps.push("Canonical fallback incorrectly marked as translated");
  }
  if (input.corpusDiscoveryBlocked) {
    gaps.push(
      "CT corpus discovery failed or silently empty — cannot claim READY (NO_CORPUS)",
    );
  }

  const overallStatus: LanguageLocalizationReadinessState =
    input.corpusDiscoveryBlocked &&
    (readiness.state === "READY" || readiness.state === "CONFIGURED")
      ? "DATA_NOT_READY"
      : readiness.state;

  const blocking =
    overallStatus === "FAILED" ||
    overallStatus === "DATA_NOT_READY" ||
    overallStatus === "DEGRADED" ||
    (input.controlledEnglishLeakCount ?? 0) > 0 ||
    input.canonicalFallbackTruthful === false;

  return {
    pack: "closure08",
    locale: readiness.locale,
    kindScope: [...input.kindScope],
    readiness,
    overallStatus,
    artifacts,
    controlledEnglishLeakCount: input.controlledEnglishLeakCount ?? 0,
    canonicalFallbackTruthful: input.canonicalFallbackTruthful ?? true,
    historicalBackfillRequired,
    seoReady: isLocalizationReadyForSeo({
      ...readiness,
      state: overallStatus,
      languageDataReady:
        input.corpusDiscoveryBlocked ? false : readiness.languageDataReady,
    }),
    searchReady: isLocalizationReadyForSearch({
      ...readiness,
      state: overallStatus,
      languageDataReady:
        input.corpusDiscoveryBlocked ? false : readiness.languageDataReady,
    }),
    safety: {
      providerCalls: 0,
      writesPerformed: 0,
      enqueuesPerformed: 0,
      publicReadSideEffectFree: true,
    },
    ownershipPolicy: {
      ctOwned: LOCALIZATION_INTEGRITY_OWNERSHIP_POLICY.ctOwned,
      plpOwned: LOCALIZATION_INTEGRITY_OWNERSHIP_POLICY.plpOwned,
      protectedExcluded: LOCALIZATION_INTEGRITY_OWNERSHIP_POLICY.protectedExcluded,
      noOwner: LOCALIZATION_INTEGRITY_OWNERSHIP_POLICY.noOwner,
      manualAuthor: LOCALIZATION_INTEGRITY_OWNERSHIP_POLICY.manualAuthor,
      mediaCarouselDecision:
        LOCALIZATION_INTEGRITY_OWNERSHIP_POLICY.mediaCarouselDecision,
      mediaCarouselNote: LOCALIZATION_INTEGRITY_OWNERSHIP_POLICY.mediaCarouselNote,
    },
    gaps,
    blocking,
  };
}
