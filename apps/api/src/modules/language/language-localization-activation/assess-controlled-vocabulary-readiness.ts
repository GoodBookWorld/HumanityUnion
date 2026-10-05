/**
 * Closure 07 — controlled vocabulary readiness for one locale.
 * Terminology preferredTerm OR WEB_UI controlled fallback ⇒ presentation-ready.
 * WEB_UI labels come from the same effective pack source as readiness (bundled → remote).
 */

import {
  CONTROLLED_PUBLIC_VOCABULARY_REGISTRY,
  glossaryConceptIdsForControlledVocabularyConcept,
  type LanguageControlledVocabularyReadinessSlice,
  type TerminologyConcept,
  type WebUiMessageTree,
} from "@hu/types";

import { resolveEffectiveWebUiMessagePack } from "../../web-ui-message-packs/resolve-effective-web-ui-message-pack.js";
import { resolveCanonicalRegistryLocale } from "../language-registry/index.js";
import { listTerminologyConcepts } from "../terminology-glossary/terminology-glossary.repository.js";

function terminologyPreferredTermForConcept(input: {
  readonly conceptId: string;
  readonly locale: string;
  readonly concepts: readonly TerminologyConcept[];
}): string | null {
  const matchIds = new Set(
    glossaryConceptIdsForControlledVocabularyConcept(input.conceptId),
  );
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
    const localeRow = concept.translations[input.locale];
    const preferred = localeRow?.preferredTerm?.trim();
    if (preferred) {
      return preferred;
    }
  }
  return null;
}

function readNestedString(messages: WebUiMessageTree, dottedPath: string): string | null {
  let current: unknown = messages;
  for (const segment of dottedPath.split(".")) {
    if (current == null || typeof current !== "object" || Array.isArray(current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  if (typeof current !== "string" || !current.trim()) {
    return null;
  }
  return current.trim();
}

function webUiLabelFromPack(conceptId: string, messages: WebUiMessageTree): string | null {
  if (conceptId === "ready_to_collaborate") {
    return readNestedString(
      messages,
      "initiativeExperience.collaboration.discussion.chrome.readyToCollaborate",
    );
  }
  if (conceptId === "helpful") {
    return (
      readNestedString(
        messages,
        "initiativeExperience.collaboration.discussion.chrome.helpful",
      ) ??
      readNestedString(
        messages,
        "initiativeExperience.author.analysis.sourceSnapshot.helpful",
      )
    );
  }
  if (conceptId === "not_helpful") {
    return (
      readNestedString(
        messages,
        "initiativeExperience.collaboration.discussion.chrome.notHelpful",
      ) ??
      readNestedString(
        messages,
        "initiativeExperience.author.analysis.sourceSnapshot.notHelpful",
      )
    );
  }
  if (conceptId === "active_allies") {
    return readNestedString(
      messages,
      "initiativeExperience.author.analysis.sourceSnapshot.activeAllies",
    );
  }
  return readNestedString(messages, `initiativeExperience.stages.${conceptId}`);
}

/**
 * Assess controlled public vocabulary readiness for a locale.
 * Missing preferredTerm with WEB_UI fallback is OK for presentation readiness.
 * Terminology preferredTerm retains higher authority than WEB_UI.
 */
export async function assessControlledVocabularyReadinessForLocale(input: {
  readonly locale: string;
  readonly listConcepts?: typeof listTerminologyConcepts;
}): Promise<LanguageControlledVocabularyReadinessSlice> {
  const listConcepts = input.listConcepts ?? listTerminologyConcepts;
  /** Gate A — glossary map keys are Registry CANONICAL LOCALE. */
  const locale =
    (await resolveCanonicalRegistryLocale(input.locale)) ?? input.locale.trim();
  let concepts: readonly TerminologyConcept[] = [];
  try {
    concepts = await listConcepts();
  } catch {
    concepts = [];
  }

  const effective = await resolveEffectiveWebUiMessagePack(locale);
  const messages = effective?.messages ?? null;

  let withTerm = 0;
  let withWebUiOnly = 0;
  let missing = 0;
  const missingPreferredTermGaps: string[] = [];
  const missingLocalizedLabelConceptIds: string[] = [];

  for (const entry of CONTROLLED_PUBLIC_VOCABULARY_REGISTRY) {
    const preferred = terminologyPreferredTermForConcept({
      conceptId: entry.conceptId,
      locale,
      concepts,
    });
    const webUi = messages ? webUiLabelFromPack(entry.conceptId, messages) : null;
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
    missingLocalizedLabelConceptIds.push(entry.conceptId);
  }

  return {
    presentationReady: missing === 0,
    conceptsChecked: CONTROLLED_PUBLIC_VOCABULARY_REGISTRY.length,
    conceptsWithTerminologyPreferredTerm: withTerm,
    conceptsWithWebUiFallbackOnly: withWebUiOnly,
    conceptsMissingLocalizedLabel: missing,
    missingLocalizedLabelConceptIds,
    missingPreferredTermGaps,
  };
}
