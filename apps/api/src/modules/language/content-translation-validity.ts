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
  type TranslatedContentRecord,
} from "@hu/types";

import { classifyLocalizationInputCurrentness } from "./localization-input-contract.js";

export type ContentTranslationReconciliationState =
  | "READY"
  | "MISSING"
  | "STALE"
  | "INVALID"
  | "BLOCKED"
  | "NOT_APPLICABLE";

export type ContentTranslationValidityClassification = {
  readonly identityCurrent: boolean;
  readonly structurallyComplete: boolean | null;
  readonly presentationEligible: boolean;
  readonly reconciliationState: ContentTranslationReconciliationState;
  /** Counts as localized CURRENT coverage only when READY + presentation-eligible. */
  readonly localizedCoverage: boolean;
  readonly workRemaining: boolean;
  readonly reasons: readonly string[];
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
export function classifyContentTranslationValidity(input: {
  readonly translation: TranslatedContentRecord | null | undefined;
  readonly liveSourceVersion?: string | null;
  readonly liveLocalizationInputVersion?: string | null;
  readonly originalFields?: Readonly<Record<string, string>> | null;
  /** When true, treat as INVALID even if otherwise READY (producer rejected path). */
  readonly terminologyProtectionFailed?: boolean;
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

  if (input.terminologyProtectionFailed === true && identityCurrent) {
    return {
      identityCurrent: true,
      structurallyComplete,
      presentationEligible: false,
      reconciliationState: "INVALID",
      localizedCoverage: false,
      workRemaining: true,
      reasons: ["terminology_protection_violation"],
    };
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
