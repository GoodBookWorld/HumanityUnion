/**
 * Localization Authority Closure 04 — Author Mode presentation for Part D
 * structured Improvement Proposals.
 *
 * Persisted fields may contain `{lifecycleStage:...}` tokens. Author-visible
 * editor surfaces compose those to English Registry labels; save merges
 * preserve tokens when the Author leaves the presented English unchanged.
 */

import {
  presentLifecycleStageTokensAsEnglish,
  preserveLifecycleStageTokensWhenPresentationUnchanged,
} from "@hu/types";

import type { SaveInitiativeStructuredProposalInput } from "./api";

export type ImprovementProposalAuthorPresentedFields = {
  readonly title: string;
  readonly summary: string;
  readonly description: string;
  readonly reason: string;
  readonly expectedImprovement: string;
  readonly supportingSources: string;
  readonly relatedDiscussionReferences: string;
};

const AUTHOR_FIELD_KEYS = [
  "title",
  "summary",
  "description",
  "reason",
  "expectedImprovement",
  "supportingSources",
  "relatedDiscussionReferences",
] as const satisfies ReadonlyArray<keyof ImprovementProposalAuthorPresentedFields>;

export function presentImprovementProposalForAuthorEditor(
  proposal: ImprovementProposalAuthorPresentedFields,
): ImprovementProposalAuthorPresentedFields {
  return {
    title: presentLifecycleStageTokensAsEnglish(proposal.title),
    summary: presentLifecycleStageTokensAsEnglish(proposal.summary),
    description: presentLifecycleStageTokensAsEnglish(proposal.description),
    reason: presentLifecycleStageTokensAsEnglish(proposal.reason),
    expectedImprovement: presentLifecycleStageTokensAsEnglish(
      proposal.expectedImprovement,
    ),
    supportingSources: presentLifecycleStageTokensAsEnglish(
      proposal.supportingSources,
    ),
    relatedDiscussionReferences: presentLifecycleStageTokensAsEnglish(
      proposal.relatedDiscussionReferences,
    ),
  };
}

export function buildImprovementProposalAuthorSaveInput(input: {
  readonly canonical: ImprovementProposalAuthorPresentedFields;
  readonly presented: ImprovementProposalAuthorPresentedFields;
}): SaveInitiativeStructuredProposalInput {
  const out: Record<string, string> = {};
  for (const key of AUTHOR_FIELD_KEYS) {
    out[key] = preserveLifecycleStageTokensWhenPresentationUnchanged({
      canonicalField: input.canonical[key],
      presentedEdit: input.presented[key],
    });
  }
  return out as SaveInitiativeStructuredProposalInput;
}
