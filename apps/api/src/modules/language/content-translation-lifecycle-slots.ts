/**
 * Localization Closure 03C.5 / 03C.5C — Collaborative Analysis CT lifecycle-slot hop.
 *
 * Brand-slot pattern without importing Media/PLP consumer code.
 * Glossary `workflow_stage.preferredTerm` is the build-time label authority.
 *
 * 03C.5C — machine-only provider output is validated BEFORE glossary reassembly
 * so preferredTerm substitution cannot falsely satisfy prose/title change checks.
 */

import type {
  InitiativeLifecycleStageId,
  LanguageCode,
  TerminologyConcept,
} from "@hu/types";
import {
  assertProviderPayloadHasNoLifecycleStageTokens,
  buildProviderOwnedLifecycleMachinePayload,
  presentLifecycleStageTokenFieldsAsEnglish,
  reassembleLifecycleStageSlotPlans,
  textContainsLifecycleStageToken,
} from "@hu/types";

import { ContentTranslationValidationError } from "./content-translation-failure-metadata.js";
import { listTerminologyConcepts } from "./terminology-glossary/terminology-glossary.repository.js";

/**
 * Resolve published Terminology Glossary preferredTerm for a workflow_stage
 * linked by stable stageId. Returns null when unavailable (fail-closed for
 * non-English CT persistence).
 */
export function resolveWorkflowStagePreferredTerm(input: {
  readonly concepts: readonly TerminologyConcept[];
  readonly stageId: InitiativeLifecycleStageId;
  readonly targetLocale: string;
}): string | null {
  const concept = input.concepts.find(
    (item) =>
      item.status === "published" &&
      item.category === "workflow_stage" &&
      item.linkedRefs?.stageId === input.stageId,
  );
  if (!concept) {
    return null;
  }
  const preferred = concept.translations[input.targetLocale]?.preferredTerm?.trim();
  return preferred && preferred.length > 0 ? preferred : null;
}

function isCollaborativeAnalysisTitleMachineKey(key: string): boolean {
  return key === "title" || /^title#m\d+$/.test(key);
}

function eligibleMachineKeys(
  machinePayload: Readonly<Record<string, string>>,
): string[] {
  return Object.keys(machinePayload)
    .sort()
    .filter((key) => {
      const value = machinePayload[key];
      return typeof value === "string" && value.trim().length > 0;
    });
}

/**
 * 03C.5C — validate provider machine-only segments against the exact payload
 * sent to the provider (never against glossary-reassembled fields).
 */
export function assertCollaborativeAnalysisMachineProseTranslated(input: {
  readonly sourceLanguage: LanguageCode | string;
  readonly targetLanguage: LanguageCode | string;
  readonly machinePayload: Readonly<Record<string, string>>;
  readonly translatedSegments: Readonly<Record<string, string>>;
}): void {
  if (input.sourceLanguage === input.targetLanguage) {
    return;
  }

  const eligibleKeys = eligibleMachineKeys(input.machinePayload);
  if (eligibleKeys.length === 0) {
    return;
  }

  for (const key of eligibleKeys) {
    const translated = input.translatedSegments[key];
    if (typeof translated !== "string" || translated.trim().length === 0) {
      throw new ContentTranslationValidationError(
        "MISSING_REQUIRED_PATH",
        `Translation provider omitted Collaborative Analysis machine segment "${key}".`,
        "malformed_response",
      );
    }
  }

  const anyChanged = eligibleKeys.some((key) => {
    const sourceValue = input.machinePayload[key]!.trim();
    const translatedValue = input.translatedSegments[key]!.trim();
    return translatedValue !== sourceValue;
  });

  if (!anyChanged) {
    throw new ContentTranslationValidationError(
      "UNCHANGED_SOURCE_PROSE",
      "Translation provider returned unchanged source text for all eligible Collaborative Analysis machine segments.",
      "malformed_response",
    );
  }
}

/**
 * 03C.5C — civic title machine prose must change independently of lifecycle-slot
 * glossary substitution.
 */
export function assertCollaborativeAnalysisMachineCivicTitleTranslated(input: {
  readonly sourceLanguage: LanguageCode | string;
  readonly targetLanguage: LanguageCode | string;
  readonly machinePayload: Readonly<Record<string, string>>;
  readonly translatedSegments: Readonly<Record<string, string>>;
}): void {
  if (input.sourceLanguage === input.targetLanguage) {
    return;
  }

  const titleKeys = eligibleMachineKeys(input.machinePayload).filter(
    isCollaborativeAnalysisTitleMachineKey,
  );

  for (const key of titleKeys) {
    const sourceValue = input.machinePayload[key]!.trim();
    const translatedRaw = input.translatedSegments[key];
    const translatedValue =
      typeof translatedRaw === "string" ? translatedRaw.trim() : "";
    if (!translatedValue) {
      throw new ContentTranslationValidationError(
        "MISSING_REQUIRED_PATH",
        `Translation provider omitted civic title machine segment "${key}".`,
        "malformed_response",
      );
    }
    if (translatedValue === sourceValue) {
      throw new ContentTranslationValidationError(
        "UNCHANGED_CIVIC_TITLE",
        `Translation provider left Collaborative Analysis civic title machine prose unchanged ("${key}").`,
        "malformed_response",
      );
    }
  }
}

function validateCollaborativeAnalysisMachineTranslation(input: {
  readonly sourceLanguage: LanguageCode | string;
  readonly targetLanguage: LanguageCode | string;
  readonly machinePayload: Readonly<Record<string, string>>;
  readonly translatedSegments: Readonly<Record<string, string>>;
}): void {
  assertCollaborativeAnalysisMachineProseTranslated(input);
  assertCollaborativeAnalysisMachineCivicTitleTranslated(input);
}

/**
 * Provider hop for collaborative_analysis: extract lifecycle slots, translate
 * MACHINE segments only, validate machine prose, then reassemble with glossary
 * preferredTerms.
 *
 * Fail-closed: unchanged machine prose / missing segments / missing preferredTerms
 * / residual tokens → ContentTranslationValidationError (no CURRENT upsert by caller).
 */
export async function translateCollaborativeAnalysisFieldsWithLifecycleSlots(input: {
  readonly sanitizedFields: Readonly<Record<string, string>>;
  readonly sourceLanguage: LanguageCode | string;
  readonly targetLanguage: string;
  readonly translatePayload: (
    payload: Readonly<Record<string, string>>,
  ) => Promise<Record<string, string>>;
}): Promise<Record<string, string>> {
  let plans;
  let providerPayload: Readonly<Record<string, string>>;
  try {
    const built = buildProviderOwnedLifecycleMachinePayload(input.sanitizedFields);
    plans = built.plans;
    providerPayload = built.payload;
  } catch (error) {
    throw new ContentTranslationValidationError(
      "OTHER_VALIDATION_FAILURE",
      error instanceof Error
        ? error.message
        : "Collaborative Analysis fields contain malformed lifecycle-stage tokens.",
      "malformed_response",
    );
  }

  const tokenLeak = assertProviderPayloadHasNoLifecycleStageTokens(providerPayload);
  if (tokenLeak.length > 0) {
    throw new ContentTranslationValidationError(
      "OTHER_VALIDATION_FAILURE",
      "Lifecycle-stage tokens must not reach the TranslationProvider.",
      "malformed_response",
    );
  }

  const translatedSegments = await input.translatePayload(providerPayload);

  // 03C.5C — validate against machine payload BEFORE glossary reassembly.
  validateCollaborativeAnalysisMachineTranslation({
    sourceLanguage: input.sourceLanguage,
    targetLanguage: input.targetLanguage,
    machinePayload: providerPayload,
    translatedSegments,
  });

  const concepts = await listTerminologyConcepts();
  const unresolved: InitiativeLifecycleStageId[] = [];
  const resolveStageLabel = (stageId: InitiativeLifecycleStageId): string | null => {
    const preferred = resolveWorkflowStagePreferredTerm({
      concepts,
      stageId,
      targetLocale: input.targetLanguage,
    });
    if (!preferred) {
      unresolved.push(stageId);
      return null;
    }
    return preferred;
  };

  const reassembled = reassembleLifecycleStageSlotPlans({
    plans,
    translatedSegments,
    resolveStageLabel,
  });

  if (reassembled.missingSegmentKeys.length > 0) {
    throw new ContentTranslationValidationError(
      "MISSING_REQUIRED_PATH",
      "Translation provider omitted required Collaborative Analysis machine segments.",
      "malformed_response",
    );
  }

  if (reassembled.unresolvedStageIds.length > 0 || unresolved.length > 0) {
    throw new ContentTranslationValidationError(
      "OTHER_VALIDATION_FAILURE",
      "Published workflow_stage preferredTerm is required for Collaborative Analysis CT.",
      "malformed_response",
    );
  }

  const values = { ...reassembled.values };
  for (const [key, value] of Object.entries(values)) {
    if (textContainsLifecycleStageToken(value)) {
      throw new ContentTranslationValidationError(
        "OTHER_VALIDATION_FAILURE",
        `Reassembled Collaborative Analysis field still contains lifecycle tokens: ${key}`,
        "malformed_response",
      );
    }
  }

  for (const path of Object.keys(input.sanitizedFields)) {
    if (typeof values[path] !== "string") {
      throw new ContentTranslationValidationError(
        "MISSING_REQUIRED_PATH",
        `Collaborative Analysis CT bag missing field after lifecycle reassembly: ${path}`,
        "malformed_response",
      );
    }
  }

  return values;
}

/** Compose English registry labels for participant-facing canonical CA fields. */
export function presentCollaborativeAnalysisCanonicalFields(
  fields: Readonly<Record<string, string>>,
): Record<string, string> {
  return presentLifecycleStageTokenFieldsAsEnglish(fields);
}
