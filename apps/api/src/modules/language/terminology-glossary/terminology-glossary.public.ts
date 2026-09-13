/**
 * Simplification Step 04A/04C — public controlled preferredTerm maps.
 * Reuses Terminology Glossary + resolveWorkflowStagePreferredTerm.
 * Never calls TranslationProvider / Gemini.
 */

import type { InitiativeLifecycleStageId, TerminologyConcept } from "@hu/types";
import {
  CONTROLLED_PUBLIC_VOCABULARY_REGISTRY,
  INITIATIVE_LIFECYCLE_STAGE_REGISTRY,
} from "@hu/types";

import { resolveLanguageRegistryLocale } from "../language-registry/language-registry.repository.js";
import {
  ensureTerminologyGlossarySeeded,
  listTerminologyConcepts,
} from "./terminology-glossary.repository.js";
import { resolveWorkflowStagePreferredTerm } from "../content-translation-lifecycle-slots.js";

export type ControlledLifecyclePreferredTermsResolution = {
  readonly locale: string;
  readonly requestedLocale: string;
  /** stageId → published preferredTerm for that locale (only entries that exist). */
  readonly preferredTermsByStageId: Readonly<Record<string, string>>;
  /**
   * CONTROLLED_PUBLIC_VOCABULARY conceptId → preferredTerm.
   * Includes lifecycle stage conceptIds (same as stageId) and domain concepts.
   */
  readonly preferredTermsByConceptId: Readonly<Record<string, string>>;
};

/**
 * Vocabulary conceptId → Glossary conceptId aliases (registry vs seed naming).
 * Keep Registry-driven; do not hardcode presentation locales.
 */
function glossaryConceptIdsForVocabularyConcept(conceptId: string): readonly string[] {
  if (conceptId === "active_allies") {
    return [conceptId, "active_ally"];
  }
  return [conceptId];
}

function preferredTermForConcept(input: {
  readonly conceptId: string;
  readonly locale: string;
  readonly concepts: readonly TerminologyConcept[];
}): string | null {
  const matchIds = new Set(glossaryConceptIdsForVocabularyConcept(input.conceptId));
  for (const concept of input.concepts) {
    if (concept.status !== "published") {
      continue;
    }
    const linkedStage = concept.linkedRefs?.stageId ?? "";
    const matches =
      matchIds.has(concept.conceptId) ||
      matchIds.has(linkedStage) ||
      concept.conceptId === input.conceptId ||
      linkedStage === input.conceptId;
    if (!matches) {
      continue;
    }
    const preferred = concept.translations[input.locale]?.preferredTerm?.trim();
    if (preferred) {
      return preferred;
    }
  }
  return null;
}

/**
 * Resolve published Terminology preferredTerms for public lifecycle stage ids
 * and controlled-vocabulary concept ids. Registry-canonicalizes the locale.
 */
export async function resolveControlledLifecyclePreferredTermsForLocale(
  localeOrAlias: string,
): Promise<ControlledLifecyclePreferredTermsResolution> {
  await ensureTerminologyGlossarySeeded();

  const requested = localeOrAlias.trim() || "en";
  const registry = await resolveLanguageRegistryLocale(requested);
  const canonicalLocale = registry?.locale ?? requested;
  const concepts = await listTerminologyConcepts();

  const preferredTermsByStageId: Record<string, string> = {};
  for (const stage of INITIATIVE_LIFECYCLE_STAGE_REGISTRY) {
    const stageId = stage.stageId as InitiativeLifecycleStageId;
    const preferred = resolveWorkflowStagePreferredTerm({
      concepts,
      stageId,
      targetLocale: canonicalLocale,
    });
    if (preferred) {
      preferredTermsByStageId[stageId] = preferred;
    }
  }

  const preferredTermsByConceptId: Record<string, string> = {
    ...preferredTermsByStageId,
  };
  for (const entry of CONTROLLED_PUBLIC_VOCABULARY_REGISTRY) {
    if (preferredTermsByConceptId[entry.conceptId]) {
      continue;
    }
    const preferred = preferredTermForConcept({
      conceptId: entry.conceptId,
      locale: canonicalLocale,
      concepts,
    });
    if (preferred) {
      preferredTermsByConceptId[entry.conceptId] = preferred;
    }
  }

  return {
    locale: canonicalLocale,
    requestedLocale: requested,
    preferredTermsByStageId,
    preferredTermsByConceptId,
  };
}
