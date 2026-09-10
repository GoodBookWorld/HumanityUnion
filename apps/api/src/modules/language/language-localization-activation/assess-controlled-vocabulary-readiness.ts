/**
 * Closure 07 — controlled vocabulary readiness for one locale.
 * Terminology preferredTerm OR WEB_UI controlled fallback ⇒ presentation-ready.
 */

import {
  CONTROLLED_PUBLIC_VOCABULARY_REGISTRY,
  type LanguageControlledVocabularyReadinessSlice,
  type TerminologyConcept,
} from "@hu/types";

import {
  loadWebUiControlledDomainLabel,
  loadWebUiControlledLifecycleStageLabel,
  loadWebUiReadyToCollaborateLabel,
} from "../controlled-lifecycle-web-ui-labels.js";
import { listTerminologyConcepts } from "../terminology-glossary/terminology-glossary.repository.js";

function terminologyPreferredTermForConcept(input: {
  readonly conceptId: string;
  readonly locale: string;
  readonly concepts: readonly TerminologyConcept[];
}): string | null {
  for (const concept of input.concepts) {
    if (concept.status !== "published") {
      continue;
    }
    const linkedStage = concept.linkedRefs?.stageId ?? "";
    const matches =
      concept.conceptId === input.conceptId ||
      linkedStage === input.conceptId;
    if (!matches) {
      continue;
    }
    const localeRow = concept.translations[input.locale];
    const preferred = localeRow?.preferredTerm?.trim();
    if (preferred) {
      return preferred;
    }
  }
  return null;
}

function webUiLabelForConcept(conceptId: string, locale: string): string | null {
  if (conceptId === "ready_to_collaborate") {
    return loadWebUiReadyToCollaborateLabel(locale);
  }
  if (
    conceptId === "helpful" ||
    conceptId === "not_helpful" ||
    conceptId === "active_allies"
  ) {
    return loadWebUiControlledDomainLabel({ conceptId, locale });
  }
  return loadWebUiControlledLifecycleStageLabel({ stageId: conceptId, locale });
}

/**
 * Assess controlled public vocabulary readiness for a locale.
 * Missing preferredTerm with WEB_UI fallback is OK for presentation readiness.
 */
export async function assessControlledVocabularyReadinessForLocale(input: {
  readonly locale: string;
  readonly listConcepts?: typeof listTerminologyConcepts;
}): Promise<LanguageControlledVocabularyReadinessSlice> {
  const listConcepts = input.listConcepts ?? listTerminologyConcepts;
  let concepts: readonly TerminologyConcept[] = [];
  try {
    concepts = await listConcepts();
  } catch {
    concepts = [];
  }

  let withTerm = 0;
  let withWebUiOnly = 0;
  let missing = 0;
  const missingPreferredTermGaps: string[] = [];

  for (const entry of CONTROLLED_PUBLIC_VOCABULARY_REGISTRY) {
    const preferred = terminologyPreferredTermForConcept({
      conceptId: entry.conceptId,
      locale: input.locale,
      concepts,
    });
    const webUi = webUiLabelForConcept(entry.conceptId, input.locale);
    if (preferred) {
      withTerm += 1;
      continue;
    }
    if (webUi) {
      withWebUiOnly += 1;
      missingPreferredTermGaps.push(entry.conceptId);
      continue;
    }
    missing += 1;
  }

  return {
    presentationReady: missing === 0,
    conceptsChecked: CONTROLLED_PUBLIC_VOCABULARY_REGISTRY.length,
    conceptsWithTerminologyPreferredTerm: withTerm,
    conceptsWithWebUiFallbackOnly: withWebUiOnly,
    conceptsMissingLocalizedLabel: missing,
    missingPreferredTermGaps,
  };
}
