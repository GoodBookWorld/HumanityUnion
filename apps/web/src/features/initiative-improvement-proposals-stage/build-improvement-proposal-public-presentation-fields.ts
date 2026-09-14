/**
 * Public Improvement Proposals presentation bag — WEB_UI system frames +
 * canonical participant prose. Used when CT is missing/incomplete so the
 * browser does not show English composeEnglishSystemFrames glue.
 */

import {
  composeImprovementProposalHuSystemFields,
  type ControlledVocabularyLabelLookup,
  type ImprovementProposalHuSystemGeneration,
  type ImprovementProposalBrowserVisibleProseField,
} from "@hu/types";

type ProposalTranslator = {
  (key: string, values?: Record<string, string | number | Date>): string;
};

export type ImprovementProposalPublicPresentationSource = {
  readonly title: string;
  readonly summary: string;
  readonly description: string;
  readonly reason: string;
  readonly expectedImprovement: string;
  readonly supportingSources: string;
  readonly relatedDiscussionReferences: string;
  readonly huSystemGeneration?: ImprovementProposalHuSystemGeneration | null;
};

/**
 * Build browser-visible fields for public Part D.
 * - Participant / author free text stays canonical.
 * - Empty system-owned reason/supportingSources (and raised-times description
 *   chrome) compose via WEB_UI from `huSystemGeneration`.
 */
export function buildImprovementProposalPublicPresentationFields(input: {
  readonly proposal: ImprovementProposalPublicPresentationSource;
  readonly t: ProposalTranslator;
  readonly labelLookup: ControlledVocabularyLabelLookup;
}): Record<ImprovementProposalBrowserVisibleProseField, string> {
  const { proposal, t, labelLookup } = input;
  const generation = proposal.huSystemGeneration ?? null;

  let description = proposal.description;
  let reason = proposal.reason;
  let supportingSources = proposal.supportingSources;

  if (generation) {
    const composed = composeImprovementProposalHuSystemFields({
      generation,
      descriptionExcerpts: proposal.description,
      t,
      labelLookup,
    });
    description = composed.description;
    reason = proposal.reason.trim() ? proposal.reason : composed.reason;
    supportingSources = proposal.supportingSources.trim()
      ? proposal.supportingSources
      : composed.supportingSources;
  }

  return {
    title: proposal.title,
    summary: proposal.summary,
    description,
    reason,
    expectedImprovement: proposal.expectedImprovement,
    supportingSources,
    relatedDiscussionReferences: proposal.relatedDiscussionReferences,
  };
}
