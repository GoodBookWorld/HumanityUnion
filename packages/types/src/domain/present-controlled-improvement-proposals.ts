/**
 * Localization Authority Closure 04 — present Improvement Proposal field bags
 * with controlled vocabulary. Presentation-only; does not mutate storage.
 */

import {
  applyControlledPublicVocabularyToProse,
  type ControlledVocabularyLabelLookup,
} from "./controlled-public-vocabulary.js";

/**
 * Apply Closure 02 controlled vocabulary substitution to every string field
 * in an Improvement Proposals presentation bag.
 */
export function presentImprovementProposalFieldsWithControlledVocabulary(input: {
  readonly fields: Readonly<Record<string, string>>;
  readonly labelLookup: ControlledVocabularyLabelLookup;
}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input.fields)) {
    if (typeof value !== "string") {
      continue;
    }
    if (!value.trim()) {
      out[key] = value;
      continue;
    }
    out[key] = applyControlledPublicVocabularyToProse({
      prose: value,
      labelLookup: input.labelLookup,
    }).text;
  }
  return out;
}
