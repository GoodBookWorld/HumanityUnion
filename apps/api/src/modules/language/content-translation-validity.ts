/**
 * STEP 15D.14.B — Gate B: single CT validity / presentation-eligibility boundary.
 *
 * Separates concepts that must not be overloaded onto `freshness=current`:
 *
 * A. IDENTITY CURRENT — source identity + version + target locale match
 * B. STRUCTURALLY COMPLETE — required translated fields (when originals provided)
 * C. PRESENTATION ELIGIBLE — real localized presentation, not a placeholder
 * D. RECONCILIATION STATE — READY / MISSING / STALE / INVALID / BLOCKED / NOT_APPLICABLE
 * E. LOCALIZATION INPUT — terminology/policy input version (15D.14.B.2)
 *
 * Gate C consumes this classifier for reconciliation. Gate B does not mutate data.
 */

import {
  isCompleteLocalizedProseBag,
  normalizeLanguageRegistryLocaleKey,
  type TerminologyConcept,
  type TranslatedContentRecord,
} from "@hu/types";

import {
  buildLocalizationInputVersionFromConcepts,
  classifyLocalizationInputCurrentness,
  collectSourceTextLeaves,
} from "./localization-input-contract.js";
import { assessRequiredTerminologyProtection } from "./terminology-protection-contract.js";

export type ContentTranslationReconciliationState =
  | "READY"
  | "MISSING"
  | "STALE"
  | "INVALID"
  | "BLOCKED"
  | "NOT_APPLICABLE";

/** Privacy-safe terminology quality note. It does not affect presentation or work. */
export type TerminologyQualityDiagnostic = {
  readonly conceptId: string;
  readonly violationType: "missing_preferred" | "residual_canonical";
};

export type ContentTranslationValidityClassification = {
  readonly identityCurrent: boolean;
  readonly structurallyComplete: boolean | null;
  readonly presentationEligible: boolean;
  readonly reconciliationState: ContentTranslationReconciliationState;
  /** Counts as localized CURRENT coverage only when READY + presentation-eligible. */
  readonly localizedCoverage: boolean;
  readonly workRemaining: boolean;
  readonly reasons: readonly string[];
  readonly terminologyQualityDiagnostics?: readonly TerminologyQualityDiagnostic[];
};

function localesEqual(a: string, b: string): boolean {
  return (
    normalizeLanguageRegistryLocaleKey(a) ===
    normalizeLanguageRegistryLocaleKey(b)
  );
}

/** Explicit deterministic/test provenance — primary placeholder signal. */
export function isDeterministicPlaceholderProvenance(
  row: Pick<TranslatedContentRecord, "translationProvider">,
): boolean {
  return String(row.translationProvider).trim().toLowerCase() === "deterministic";
}

function collectNonEmptyStringLeaves(content: unknown): string[] {
  if (typeof content === "string") {
    return content.trim() ? [content] : [];
  }
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return [];
  }
  const out: string[] = [];
  for (const value of Object.values(content as Record<string, unknown>)) {
    if (typeof value === "string" && value.trim()) {
      out.push(value);
    }
  }
  return out;
}

/**
 * Defensive payload check matching DeterministicTranslationProvider:
 * every non-empty string leaf is prefixed with `[${targetLanguage}] `.
 * Never used alone to reject legitimate human English.
 */
export function hasDeterministicPlaceholderPayloadPattern(
  row: Pick<TranslatedContentRecord, "targetLanguage" | "translatedContent">,
): boolean {
  const target = String(row.targetLanguage);
  const prefixes = [
    `[${target}] `,
    `[${normalizeLanguageRegistryLocaleKey(target)}] `,
  ];
  const values = collectNonEmptyStringLeaves(row.translatedContent);
  if (values.length === 0) {
    return false;
  }
  return values.every((value) => prefixes.some((prefix) => value.startsWith(prefix)));
}

/**
 * Known placeholder artifact (provider-agnostic real translations are not).
 * Same-locale passthrough is not a cross-locale placeholder.
 */
export function isKnownPlaceholderTranslation(
  row: Pick<
    TranslatedContentRecord,
    "translationProvider" | "targetLanguage" | "translatedContent" | "sourceLanguage"
  >,
): boolean {
  if (localesEqual(row.sourceLanguage, row.targetLanguage)) {
    return false;
  }
  if (isDeterministicPlaceholderProvenance(row)) {
    return true;
  }
  return hasDeterministicPlaceholderPayloadPattern(row);
}

/**
 * Provenance represents real localization (machine non-deterministic, or human).
 * Do NOT require provider === "gemini".
 */
export function hasRealLocalizationProvenance(
  row: Pick<TranslatedContentRecord, "translationProvider" | "translationKind">,
): boolean {
  if (row.translationKind === "human" || row.translationKind === "author-approved") {
    return true;
  }
  if (isDeterministicPlaceholderProvenance(row)) {
    return false;
  }
  const id = String(row.translationProvider).trim().toLowerCase();
  return id.length > 0;
}

function translatedFieldsFromRecord(
  content: TranslatedContentRecord["translatedContent"],
): Record<string, string> {
  if (typeof content === "string") {
    return { text: content };
  }
  if (!content || typeof content !== "object") {
    return {};
  }
  return Object.fromEntries(
    Object.entries(content).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

/**
 * Single CT validity classifier — reuse for readiness, reconciliation planning,
 * and public resolve presentation eligibility.
 */
function isUntranslatedSourceEquivalent(input: {
  readonly originalFields: Readonly<Record<string, string>>;
  readonly localizedFields: Readonly<Record<string, string>>;
}): boolean {
  const keys = Object.keys(input.originalFields).filter((key) => {
    const value = input.originalFields[key];
    return typeof value === "string" && value.trim().length > 0;
  });
  if (keys.length === 0) {
    return false;
  }
  return keys.every((key) => {
    const localized = input.localizedFields[key];
    return typeof localized === "string" && localized.trim() === input.originalFields[key]!.trim();
  });
}

/**
 * Durable proof that the current source and current localization input were
 * already attempted and failed only as a terminology quality diagnostic.
 * Does not rewrite the stored row.
 */
export type AttemptedCurrentInputFailure = {
  readonly failureReasonCode: string | null;
  readonly sourceVersion: string | null;
  readonly localizationInputVersion?: string | null;
  readonly targetLocale?: string | null;
  readonly localeFailures?: readonly {
    readonly targetLocale: string;
    readonly failureReasonCode: string;
  }[];
};

const TERMINOLOGY_ONLY_FAILURE = "TERMINOLOGY_PROTECTION_VIOLATION";

/**
 * True only when durable metadata shows this exact live source version and
 * live localization input were attempted, and every recorded reason for that
 * attempt is terminology protection. Any other reason, or a missing version,
 * leaves real input staleness in place.
 */
export function isTerminologyOnlyAttemptOfCurrentInput(input: {
  readonly liveSourceVersion?: string | null;
  readonly liveLocalizationInputVersion?: string | null;
  readonly failure?: AttemptedCurrentInputFailure | null;
}): boolean {
  const liveSource = input.liveSourceVersion?.trim() ?? "";
  const liveInput = input.liveLocalizationInputVersion?.trim() ?? "";
  const failedSource = input.failure?.sourceVersion?.trim() ?? "";
  const failedInput = input.failure?.localizationInputVersion?.trim() ?? "";
  if (!liveSource || !liveInput || !failedSource || !failedInput) {
    return false;
  }
  if (liveSource !== failedSource || liveInput !== failedInput) {
    return false;
  }
  if (input.failure?.failureReasonCode !== TERMINOLOGY_ONLY_FAILURE) {
    return false;
  }
  const target = input.failure.targetLocale?.trim() ?? "";
  const localeReasons = (input.failure.localeFailures ?? []).filter((row) => {
    if (!target) {
      return true;
    }
    return localesEqual(row.targetLocale, target);
  });
  return localeReasons.every((row) => row.failureReasonCode === TERMINOLOGY_ONLY_FAILURE);
}

export function classifyContentTranslationValidity(input: {
  readonly translation: TranslatedContentRecord | null | undefined;
  readonly liveSourceVersion?: string | null;
  readonly liveLocalizationInputVersion?: string | null;
  readonly originalFields?: Readonly<Record<string, string>> | null;
  /**
   * F.3.31C.1 — current source and current input were already attempted and
   * failed only TERMINOLOGY_PROTECTION_VIOLATION. An otherwise
   * presentation-eligible stored row is not input-stale work.
   */
  readonly terminologyOnlyCurrentInputAttempted?: boolean;
}): ContentTranslationValidityClassification {
  const row = input.translation ?? null;
  if (!row) {
    return {
      identityCurrent: false,
      structurallyComplete: null,
      presentationEligible: false,
      reconciliationState: "MISSING",
      localizedCoverage: false,
      workRemaining: true,
      reasons: ["no_translation_row"],
    };
  }

  if (localesEqual(row.sourceLanguage, row.targetLanguage)) {
    return {
      identityCurrent: true,
      structurallyComplete: true,
      presentationEligible: false,
      reconciliationState: "NOT_APPLICABLE",
      localizedCoverage: false,
      workRemaining: false,
      reasons: ["same_locale"],
    };
  }

  const liveVersion = input.liveSourceVersion?.trim() || null;
  const versionMatches = liveVersion == null || row.sourceVersion === liveVersion;
  const identityCurrent =
    versionMatches && row.freshness === "current" && row.stale !== true;

  const isStaleRow =
    row.stale === true ||
    row.freshness === "stale" ||
    (liveVersion != null && row.sourceVersion !== liveVersion);

  let structurallyComplete: boolean | null = null;
  if (input.originalFields) {
    structurallyComplete = isCompleteLocalizedProseBag({
      originalFields: input.originalFields,
      localizedFields: translatedFieldsFromRecord(row.translatedContent),
    });
  }

  const placeholder = isKnownPlaceholderTranslation(row);
  const realProvenance = hasRealLocalizationProvenance(row);

  if (isStaleRow && !identityCurrent) {
    return {
      identityCurrent: false,
      structurallyComplete,
      presentationEligible: false,
      reconciliationState: "STALE",
      localizedCoverage: false,
      workRemaining: true,
      reasons: ["stale_identity"],
    };
  }

  // 15D.14.B.2 — terminology/policy input drift → reconcilable STALE.
  // Historical rows without localizationInputVersion stay legacy (not auto-STALE).
  if (identityCurrent && input.liveLocalizationInputVersion) {
    const inputState = classifyLocalizationInputCurrentness({
      storedLocalizationInputVersion: row.localizationInputVersion,
      liveLocalizationInputVersion: input.liveLocalizationInputVersion,
    });
    if (inputState === "stale") {
      const localizedFields = translatedFieldsFromRecord(row.translatedContent);
      const presentationEligibleDespiteInputDrift =
        input.terminologyOnlyCurrentInputAttempted === true &&
        input.originalFields != null &&
        structurallyComplete === true &&
        !placeholder &&
        realProvenance &&
        !isUntranslatedSourceEquivalent({
          originalFields: input.originalFields,
          localizedFields,
        });
      if (!presentationEligibleDespiteInputDrift) {
        return {
          identityCurrent: false,
          structurallyComplete,
          presentationEligible: false,
          reconciliationState: "STALE",
          localizedCoverage: false,
          workRemaining: true,
          reasons: ["localization_input_stale"],
        };
      }
    }
  }

  if (identityCurrent && placeholder) {
    return {
      identityCurrent: true,
      structurallyComplete,
      presentationEligible: false,
      reconciliationState: "INVALID",
      localizedCoverage: false,
      workRemaining: true,
      reasons: ["deterministic_placeholder"],
    };
  }

  if (identityCurrent && structurallyComplete === false) {
    return {
      identityCurrent: true,
      structurallyComplete: false,
      presentationEligible: false,
      reconciliationState: "STALE",
      localizedCoverage: false,
      workRemaining: true,
      reasons: ["structurally_incomplete"],
    };
  }

  if (
    identityCurrent &&
    input.originalFields &&
    isUntranslatedSourceEquivalent({
      originalFields: input.originalFields,
      localizedFields: translatedFieldsFromRecord(row.translatedContent),
    })
  ) {
    return {
      identityCurrent: true,
      structurallyComplete,
      presentationEligible: false,
      reconciliationState: "INVALID",
      localizedCoverage: false,
      workRemaining: true,
      reasons: ["untranslated_source_equivalent"],
    };
  }

  if (identityCurrent && realProvenance && structurallyComplete !== false) {
    return {
      identityCurrent: true,
      structurallyComplete: structurallyComplete ?? true,
      presentationEligible: true,
      reconciliationState: "READY",
      localizedCoverage: true,
      workRemaining: false,
      reasons: [],
    };
  }

  if (identityCurrent && !realProvenance) {
    return {
      identityCurrent: true,
      structurallyComplete,
      presentationEligible: false,
      reconciliationState: "INVALID",
      localizedCoverage: false,
      workRemaining: true,
      reasons: ["unrecognized_provenance"],
    };
  }

  return {
    identityCurrent: false,
    structurallyComplete,
    presentationEligible: false,
    reconciliationState: "BLOCKED",
    localizedCoverage: false,
    workRemaining: true,
    reasons: ["not_ready"],
  };
}

/** Preferred / fallback presentation may use this row only when true. */
export function isPresentationEligibleTranslation(
  row: TranslatedContentRecord,
  liveSourceVersion?: string | null,
  liveLocalizationInputVersion?: string | null,
): boolean {
  return classifyContentTranslationValidity({
    translation: row,
    liveSourceVersion,
    liveLocalizationInputVersion,
  }).presentationEligible;
}

/**
 * Gate C — classify using live localizationInputVersion when concepts and
 * original fields are available. Exact terminology mismatches on an otherwise
 * presentation-eligible row are quality diagnostics, not reconciliation work.
 *
 * Historical rows without localizationInputVersion stay legacy_unversioned
 * (not mass-STALE). A real terminology-digest change remains STALE work until
 * that current source and current input have been attempted. A durable
 * terminology-only failure of that exact pair does not keep an otherwise
 * presentation-eligible stored row in work.
 */
export function classifyContentTranslationForReconciliation(input: {
  readonly translation: TranslatedContentRecord | null | undefined;
  readonly liveSourceVersion?: string | null;
  readonly originalFields?: Readonly<Record<string, string>> | null;
  readonly concepts?: readonly TerminologyConcept[] | null;
  readonly attemptedCurrentInputFailure?: AttemptedCurrentInputFailure | null;
}): ContentTranslationValidityClassification {
  const row = input.translation ?? null;
  let liveLocalizationInputVersion: string | undefined;
  let terminologyQualityDiagnostics: readonly TerminologyQualityDiagnostic[] | undefined;

  if (row && input.concepts && input.originalFields) {
    const sourceText = collectSourceTextLeaves(input.originalFields);
    const translatedText = collectSourceTextLeaves(
      translatedFieldsFromRecord(row.translatedContent),
    );
    const assessment = assessRequiredTerminologyProtection({
      concepts: input.concepts,
      targetLocale: String(row.targetLanguage),
      sourceText,
      translatedText,
    });
    if (!assessment.ok) {
      terminologyQualityDiagnostics = assessment.violations.map((violation) => ({
        conceptId: violation.conceptId,
        violationType: violation.reason,
      }));
    }
    liveLocalizationInputVersion = buildLocalizationInputVersionFromConcepts({
      sourceVersion: input.liveSourceVersion ?? row.sourceVersion,
      targetLocale: String(row.targetLanguage),
      concepts: input.concepts,
      sourceText,
    }).localizationInputVersion;
  }

  const validity = classifyContentTranslationValidity({
    translation: row,
    liveSourceVersion: input.liveSourceVersion,
    liveLocalizationInputVersion,
    originalFields: input.originalFields,
    terminologyOnlyCurrentInputAttempted: isTerminologyOnlyAttemptOfCurrentInput({
      liveSourceVersion: input.liveSourceVersion ?? row?.sourceVersion,
      liveLocalizationInputVersion,
      failure: input.attemptedCurrentInputFailure,
    }),
  });
  if (
    validity.reconciliationState === "READY" &&
    terminologyQualityDiagnostics &&
    terminologyQualityDiagnostics.length > 0
  ) {
    return { ...validity, terminologyQualityDiagnostics };
  }
  return validity;
}
