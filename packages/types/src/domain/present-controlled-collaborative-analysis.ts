/**
 * Localization Authority Closure 03 — present CA field bags with controlled vocabulary.
 * Presentation-only; does not mutate stored CT.
 */

import {
  applyControlledPublicVocabularyToProse,
  type ControlledVocabularyLabelLookup,
} from "./controlled-public-vocabulary.js";

/**
 * Apply Closure 02 controlled vocabulary substitution to every string field
 * in a Collaborative Analysis presentation bag.
 */
export function presentCollaborativeAnalysisFieldsWithControlledVocabulary(input: {
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
