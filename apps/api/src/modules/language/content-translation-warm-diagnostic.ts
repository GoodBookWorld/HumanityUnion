/**
 * Pack 02G Task 07B — non-sensitive warm target-resolution diagnostic snapshot.
 * Observability only; does not change eligibility or translation behavior.
 */

import type { ContentTranslationSourceKind, LanguageCode } from "@hu/types";

/** Approved Registry fields only — never aliases, names, provider mappings, timestamps. */
export interface ContentTranslationWarmRegistryCandidateDiagnostic {
  readonly locale: string;
  readonly enabled: boolean;
  readonly contentTranslationEnabled: boolean;
}

export interface ContentTranslationWarmTargetDiagnostic {
  readonly component: "content-translation-warm";
  readonly sourceKind: ContentTranslationSourceKind | string;
  readonly sourceRecordId: string;
  readonly sourceVersion: string;
  readonly sourceLanguage: LanguageCode | string;
  readonly registryCandidates: readonly ContentTranslationWarmRegistryCandidateDiagnostic[];
  readonly warmTargetLocales: readonly LanguageCode[];
}

const REGISTRY_CANDIDATE_KEYS = [
  "locale",
  "enabled",
  "contentTranslationEnabled",
] as const;

/**
 * Build the structured warm target-resolution log payload.
 * Callers must pass already-sanitized Registry candidates (locale/enabled/contentTranslationEnabled only).
 */
export function buildContentTranslationWarmTargetDiagnostic(input: {
  readonly sourceKind: ContentTranslationSourceKind | string;
  readonly sourceRecordId: string;
  readonly sourceVersion: string;
  readonly sourceLanguage: LanguageCode | string;
  readonly registryCandidates: readonly ContentTranslationWarmRegistryCandidateDiagnostic[];
  readonly warmTargetLocales: readonly LanguageCode[];
}): ContentTranslationWarmTargetDiagnostic {
  const registryCandidates = input.registryCandidates.map((row) => ({
    locale: row.locale,
    enabled: row.enabled === true,
    contentTranslationEnabled: row.contentTranslationEnabled === true,
  }));

  return {
    component: "content-translation-warm",
    sourceKind: input.sourceKind,
    sourceRecordId: input.sourceRecordId,
    sourceVersion: input.sourceVersion,
    sourceLanguage: input.sourceLanguage,
    registryCandidates,
    warmTargetLocales: [...input.warmTargetLocales],
  };
}

/** Test helper — approved keys on each registry candidate entry. */
export function contentTranslationWarmRegistryCandidateDiagnosticKeys(): readonly string[] {
  return [...REGISTRY_CANDIDATE_KEYS];
}
