/**
 * Localization 03C.5A — Author Mode presentation for Collaborative Analysis.
 *
 * Persisted / API canonical fields may contain `{lifecycleStage:...}` tokens.
 * Author-visible editor and draft-preview surfaces must compose those to
 * English lifecycle registry labels. Save merges preserve semantic tokens when
 * the Author does not change a field relative to that presentation.
 */

import type { InitiativeCollaborativeAnalysis } from "@hu/types";
import {
  mergeCollaborativeAnalysisAuthorSaveFields,
  presentLifecycleStageTokensAsEnglish,
} from "@hu/types";

import type { SaveInitiativeCollaborativeAnalysisDraftInput } from "./api";

export type CollaborativeAnalysisAuthorPresentedFields = {
  readonly title: string;
  readonly summary: string;
  readonly supportingEvidence: string;
  readonly risks: string;
  readonly openQuestions: string;
  readonly suggestedImprovements: string;
  readonly references: string;
};

const AUTHOR_FIELD_KEYS = [
  "title",
  "summary",
  "supportingEvidence",
  "risks",
  "openQuestions",
  "suggestedImprovements",
  "references",
] as const satisfies ReadonlyArray<keyof CollaborativeAnalysisAuthorPresentedFields>;

export function presentCollaborativeAnalysisForAuthorEditor(
  analysis: Pick<
    InitiativeCollaborativeAnalysis,
    (typeof AUTHOR_FIELD_KEYS)[number]
  >,
): CollaborativeAnalysisAuthorPresentedFields {
  return {
    title: presentLifecycleStageTokensAsEnglish(analysis.title),
    summary: presentLifecycleStageTokensAsEnglish(analysis.summary),
    supportingEvidence: presentLifecycleStageTokensAsEnglish(
      analysis.supportingEvidence,
    ),
    risks: presentLifecycleStageTokensAsEnglish(analysis.risks),
    openQuestions: presentLifecycleStageTokensAsEnglish(
      analysis.openQuestions ?? "",
    ),
    suggestedImprovements: presentLifecycleStageTokensAsEnglish(
      analysis.suggestedImprovements,
    ),
    references: presentLifecycleStageTokensAsEnglish(analysis.references),
  };
}

/**
 * Build a save payload that preserves semantic lifecycle tokens when the
 * Author leaves the corresponding English labels unchanged (03C.5A / 03C.5B).
 */
export function buildCollaborativeAnalysisAuthorSaveInput(input: {
  readonly analysis: Pick<
    InitiativeCollaborativeAnalysis,
    (typeof AUTHOR_FIELD_KEYS)[number]
  >;
  readonly presented: CollaborativeAnalysisAuthorPresentedFields;
}): SaveInitiativeCollaborativeAnalysisDraftInput {
  const canonical = {
    title: input.analysis.title,
    summary: input.analysis.summary,
    supportingEvidence: input.analysis.supportingEvidence,
    risks: input.analysis.risks,
    openQuestions: input.analysis.openQuestions ?? "",
    suggestedImprovements: input.analysis.suggestedImprovements,
    references: input.analysis.references,
  };
  return mergeCollaborativeAnalysisAuthorSaveFields({
    canonical,
    presented: { ...input.presented },
  });
}

export function authorPresentedFieldsContainLifecycleTokens(
  fields: CollaborativeAnalysisAuthorPresentedFields,
): boolean {
  return AUTHOR_FIELD_KEYS.some((key) =>
    /\{lifecycleStage:[^}]*\}/.test(fields[key]),
  );
}
