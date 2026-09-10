/**
 * Localization Authority Closure 06 — unified public localization integrity gate.
 *
 * Deterministic presentation-output helper (not a browser crawler / DB scan).
 * Detects classes of public localization leakage while ignoring intentionally
 * protected / participant-authored originals.
 */

import {
  CONTROLLED_PUBLIC_VOCABULARY_REGISTRY,
  type ControlledVocabularyLabelLookup,
  type PublicPresentationAuthority,
  resolveControlledLifecycleLabel,
} from "@hu/types";

import {
  findControlledEnglishLifecycleLeaks,
  findHardcodedImprovementProposalSystemLabelLeaks,
  type ControlledEnglishLeakFinding,
  type HardcodedSystemLabelLeakFinding,
} from "../public-initiative-experience/assert-no-controlled-english-lifecycle-leaks";

export type PublicLocalizationIntegrityFindingKind =
  | "controlled_english_leak"
  | "system_english_label_leak"
  | "canonical_fallback_marked_translated"
  | "locale_resolver_divergence"
  | "protected_original_ok";

export type PublicLocalizationIntegrityFinding = {
  readonly kind: PublicLocalizationIntegrityFindingKind;
  readonly detail: string;
  readonly fieldId?: string;
};

export type PublicPresentationFieldSnapshot = {
  readonly fieldId: string;
  readonly presentedValue: string;
  readonly authority: PublicPresentationAuthority;
  /**
   * Caller-declared presentation mode. Integrity fails when authority is
   * CANONICAL_ENGLISH_FALLBACK but mode claims "translated".
   */
  readonly presentationMode?: "translated" | "original" | "canonical_fallback";
  /** When true, English content is intentionally protected and must not leak-flag. */
  readonly protectedOriginal?: boolean;
  /** Optional WEB_UI localized chrome that should appear instead of English. */
  readonly expectedWebUiLabel?: string | null;
  readonly englishSystemLabel?: string | null;
};

export type PublicLocalizationIntegrityInput = {
  readonly documentLocale: string;
  readonly surfaceId?: string;
  readonly presentationText?: string;
  readonly labelLookup?: ControlledVocabularyLabelLookup;
  readonly fields?: readonly PublicPresentationFieldSnapshot[];
  /**
   * Same semantic field resolved under two locales / paths — must share
   * authority ordering (winner authority identity), not necessarily the string.
   */
  readonly resolverPathComparisons?: readonly {
    readonly fieldId: string;
    readonly pathA: { readonly locale: string; readonly authorityOrder: readonly PublicPresentationAuthority[] };
    readonly pathB: { readonly locale: string; readonly authorityOrder: readonly PublicPresentationAuthority[] };
  }[];
};

export type PublicLocalizationIntegrityReport = {
  readonly ok: boolean;
  readonly findings: readonly PublicLocalizationIntegrityFinding[];
  readonly controlledEnglishLeaks: readonly ControlledEnglishLeakFinding[];
  readonly systemLabelLeaks: readonly HardcodedSystemLabelLeakFinding[];
};

function sameAuthorityOrder(
  a: readonly PublicPresentationAuthority[],
  b: readonly PublicPresentationAuthority[],
): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((authority, index) => authority === b[index]);
}

/**
 * Inspect final presentation values for Closure 06 leakage classes A–E.
 */
export function inspectPublicLocalizationIntegrity(
  input: PublicLocalizationIntegrityInput,
): PublicLocalizationIntegrityReport {
  const findings: PublicLocalizationIntegrityFinding[] = [];
  const controlledEnglishLeaks =
    input.presentationText && input.labelLookup
      ? findControlledEnglishLifecycleLeaks({
          presentationText: input.presentationText,
          documentLocale: input.documentLocale,
          labelLookup: input.labelLookup,
        })
      : [];

  for (const leak of controlledEnglishLeaks) {
    findings.push({
      kind: "controlled_english_leak",
      detail: `${leak.conceptId}: found "${leak.englishForm}" expected "${leak.expectedLocalizedLabel}"`,
      fieldId: leak.conceptId,
    });
  }

  const systemLabelLeaks = input.presentationText
    ? findHardcodedImprovementProposalSystemLabelLeaks({
        presentationText: input.presentationText,
        documentLocale: input.documentLocale,
      })
    : [];

  for (const leak of systemLabelLeaks) {
    findings.push({
      kind: "system_english_label_leak",
      detail: `Cap02 English field label "${leak.englishLabel}"`,
    });
  }

  for (const field of input.fields ?? []) {
    if (field.protectedOriginal) {
      findings.push({
        kind: "protected_original_ok",
        detail: `Protected original preserved for ${field.fieldId}`,
        fieldId: field.fieldId,
      });
      continue;
    }

    if (
      field.authority === "CANONICAL_ENGLISH_FALLBACK" &&
      field.presentationMode === "translated"
    ) {
      findings.push({
        kind: "canonical_fallback_marked_translated",
        detail: `Field ${field.fieldId} is canonical fallback but marked translated`,
        fieldId: field.fieldId,
      });
    }

    if (
      input.documentLocale !== "en" &&
      field.englishSystemLabel &&
      field.expectedWebUiLabel &&
      field.expectedWebUiLabel.trim() &&
      field.expectedWebUiLabel !== field.englishSystemLabel &&
      field.presentedValue.includes(field.englishSystemLabel)
    ) {
      findings.push({
        kind: "system_english_label_leak",
        detail: `Field ${field.fieldId}: found English "${field.englishSystemLabel}" expected WEB_UI "${field.expectedWebUiLabel}"`,
        fieldId: field.fieldId,
      });
    }
  }

  for (const comparison of input.resolverPathComparisons ?? []) {
    if (!sameAuthorityOrder(comparison.pathA.authorityOrder, comparison.pathB.authorityOrder)) {
      findings.push({
        kind: "locale_resolver_divergence",
        detail:
          `Field ${comparison.fieldId}: authority order diverges between ` +
          `${comparison.pathA.locale} and ${comparison.pathB.locale}`,
        fieldId: comparison.fieldId,
      });
    }
  }

  const blocking = findings.filter((row) => row.kind !== "protected_original_ok");
  return {
    ok: blocking.length === 0,
    findings,
    controlledEnglishLeaks,
    systemLabelLeaks,
  };
}

export function assertPublicLocalizationIntegrity(
  input: PublicLocalizationIntegrityInput,
): void {
  const report = inspectPublicLocalizationIntegrity(input);
  const blocking = report.findings.filter((row) => row.kind !== "protected_original_ok");
  if (blocking.length === 0) {
    return;
  }
  const detail = blocking.map((row) => `${row.kind}: ${row.detail}`).join("; ");
  throw new Error(
    `PUBLIC_LOCALIZATION_INTEGRITY_LEAK` +
      (input.surfaceId ? ` surface=${input.surfaceId}` : "") +
      ` locale=${input.documentLocale}: ${detail}`,
  );
}

/**
 * Lightweight helper: when a controlled vocabulary lookup has a localized label,
 * ensure presentation text does not still contain the English registry form.
 */
export function assertControlledVocabularyPresentationIntegrity(input: {
  readonly presentationText: string;
  readonly documentLocale: string;
  readonly labelLookup: ControlledVocabularyLabelLookup;
  readonly surfaceId?: string;
}): void {
  assertPublicLocalizationIntegrity({
    documentLocale: input.documentLocale,
    surfaceId: input.surfaceId,
    presentationText: input.presentationText,
    labelLookup: input.labelLookup,
  });
}

/** Re-export registry size for tests proving the gate covers controlled vocabulary. */
export function controlledPublicVocabularyRegistrySize(): number {
  return CONTROLLED_PUBLIC_VOCABULARY_REGISTRY.length;
}

export function resolveLookupLabelForTests(
  conceptId: string,
  labelLookup: ControlledVocabularyLabelLookup,
): string {
  const entry = CONTROLLED_PUBLIC_VOCABULARY_REGISTRY.find((row) => row.conceptId === conceptId);
  if (!entry) {
    return "";
  }
  const candidates = labelLookup[entry.conceptId];
  if (!candidates) {
    return "";
  }
  return resolveControlledLifecycleLabel({
    ...candidates,
    stageId: candidates.stageId ?? entry.stageId ?? null,
    registryCanonicalEnglishLabel:
      candidates.registryCanonicalEnglishLabel ?? entry.canonicalEnglishForms[0],
  }).label;
}
