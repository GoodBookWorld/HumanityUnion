/**
 * Pack 02F — glossary translation / alias integrity (Task 03 Admin API reuse).
 */

import type {
  TerminologyConcept,
  TerminologyConceptStatus,
  TerminologyLocaleTranslation,
} from "@hu/types";
import { isTerminologyConceptStatus } from "@hu/types";

import { TerminologyGlossaryValidationError } from "./terminology-glossary.errors.js";

export function normalizeGlossaryTerm(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeGlossaryAliasList(aliases: readonly string[] | undefined): string[] {
  if (!aliases || aliases.length === 0) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of aliases) {
    const normalized = normalizeGlossaryTerm(raw);
    if (!normalized) {
      throw new TerminologyGlossaryValidationError("Glossary aliases must not be empty.");
    }
    const dedupeKey = normalized.toLowerCase();
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);
    result.push(normalized);
  }
  return result;
}

export function normalizeLocaleTranslation(
  translation: TerminologyLocaleTranslation,
): TerminologyLocaleTranslation {
  const preferredTerm = normalizeGlossaryTerm(translation.preferredTerm);
  if (!preferredTerm) {
    throw new TerminologyGlossaryValidationError("preferredTerm is required.");
  }
  const aliases = normalizeGlossaryAliasList(translation.aliases);
  const guidance =
    translation.guidance === undefined
      ? undefined
      : normalizeGlossaryTerm(translation.guidance) || undefined;

  return {
    preferredTerm,
    aliases,
    ...(guidance ? { guidance } : {}),
  };
}

function collectForeignCanonicalTerms(
  concepts: readonly TerminologyConcept[],
  conceptId: string,
): Map<string, string> {
  const byLower = new Map<string, string>();
  for (const concept of concepts) {
    if (concept.conceptId === conceptId) {
      continue;
    }
    byLower.set(concept.canonicalEnglishTerm.toLowerCase(), concept.conceptId);
  }
  return byLower;
}

/**
 * Reject preferred terms / aliases that equal another concept's canonical English term.
 * Ensures Participant / Member / Membership cannot collapse via aliases.
 */
export function assertGlossaryAliasIntegrity(input: {
  readonly conceptId: string;
  readonly translations: Readonly<Record<string, TerminologyLocaleTranslation>>;
  readonly allConcepts: readonly TerminologyConcept[];
}): void {
  const foreignCanonical = collectForeignCanonicalTerms(input.allConcepts, input.conceptId);

  for (const [locale, translation] of Object.entries(input.translations)) {
    const normalized = normalizeLocaleTranslation(translation);
    const candidates = [normalized.preferredTerm, ...normalized.aliases];
    for (const term of candidates) {
      const collidingConceptId = foreignCanonical.get(term.toLowerCase());
      if (collidingConceptId) {
        throw new TerminologyGlossaryValidationError(
          `Glossary term "${term}" for locale "${locale}" collides with canonical English of concept "${collidingConceptId}".`,
        );
      }
    }
  }
}

export function assertTerminologyStatus(value: unknown): TerminologyConceptStatus {
  if (!isTerminologyConceptStatus(value)) {
    throw new TerminologyGlossaryValidationError(
      "status must be draft, published, or retired.",
    );
  }
  return value;
}

export function sortTerminologyConcepts(
  concepts: readonly TerminologyConcept[],
): TerminologyConcept[] {
  return [...concepts].sort((a, b) => a.conceptId.localeCompare(b.conceptId));
}
