/**
 * Build the authoritative CT field bag for Improvement Proposal Part D.
 * English/canonical composition for system frames (source language = en).
 * Matches browser-visible PublicResult/ContentFields boundary.
 */

import type {
  ImprovementProposalHuSystemGeneration,
  InitiativeStructuredProposal,
} from "./initiative-improvement-proposals-stage.js";
import type { PublicInitiativeStructuredProposal } from "./public-initiative-improvement-proposals-stage.js";
import { IMPROVEMENT_PROPOSAL_BROWSER_VISIBLE_PROSE_FIELDS } from "./improvement-proposal-localization-boundary.js";

type ProposalLike = Pick<
  InitiativeStructuredProposal | PublicInitiativeStructuredProposal,
  | "title"
  | "summary"
  | "description"
  | "reason"
  | "expectedImprovement"
  | "supportingSources"
  | "relatedDiscussionReferences"
> & {
  readonly huSystemGeneration?: ImprovementProposalHuSystemGeneration | null;
};

function stageLabelFromToken(token: string): string {
  const trimmed = token.trim();
  if (!trimmed) {
    return "discussion";
  }
  // `{lifecycleStage:discussion}` → discussion
  const match = trimmed.match(/\{lifecycleStage:([^}]+)\}/i);
  return match?.[1]?.trim() || trimmed;
}

/**
 * English system frames used as CT source when Author left free-text empty.
 * Mirrors en.json `author.proposal.generated.*` wording (source language).
 */
function composeEnglishSystemFrames(input: {
  readonly generation: ImprovementProposalHuSystemGeneration;
  readonly descriptionExcerpts: string;
}): {
  readonly description: string;
  readonly reason: string;
  readonly supportingSources: string;
} {
  const stage = stageLabelFromToken(input.generation.discussionStageToken);
  const category = input.generation.category.trim() || "general";
  const description =
    input.generation.descriptionKind === "raised_times"
      ? `This idea was raised ${input.generation.raisedCount} time(s) in ${stage}, in similar words:\n${input.descriptionExcerpts}`
      : input.descriptionExcerpts;

  const reason =
    input.generation.reasonKind === "raised_independently"
      ? `Raised independently by ${input.generation.participantCount} participant(s) in the ${category} area of ${stage} — repetition suggests shared concern.`
      : `Raised by ${input.generation.participantCount} participant(s) in the ${category} area of ${stage}.`;

  const supportingSources =
    input.generation.supportingSourcesKind === "helpful_reactions"
      ? `${input.generation.helpfulCount} Helpful reaction(s) across ${input.generation.memberCount} related comment(s) in ${stage}.`
      : `${input.generation.memberCount} related comment(s) in ${stage} (no Helpful reactions recorded yet).`;

  return { description, reason, supportingSources };
}

/**
 * Canonical CT / PublicTranslatedFields bag for one Part D proposal.
 * Category keys remain embedded in composed English reason prose only —
 * never a standalone CT leaf.
 */
export function buildImprovementProposalCtFields(
  proposal: ProposalLike,
): Record<(typeof IMPROVEMENT_PROPOSAL_BROWSER_VISIBLE_PROSE_FIELDS)[number], string> {
  const generation = proposal.huSystemGeneration ?? null;
  let description = proposal.description;
  let reason = proposal.reason;
  let supportingSources = proposal.supportingSources;

  if (generation) {
    const composed = composeEnglishSystemFrames({
      generation,
      descriptionExcerpts: proposal.description,
    });
    if (generation.descriptionKind === "raised_times") {
      description = composed.description;
    }
    if (!proposal.reason.trim()) {
      reason = composed.reason;
    }
    if (!proposal.supportingSources.trim()) {
      supportingSources = composed.supportingSources;
    }
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
