import { randomUUID } from "node:crypto";

import {
  lifecycleStageToken,
  type InitiativeProposalGroup,
  type InitiativeProposalIntelligenceSnapshot,
  type InitiativeStructuredProposal,
  type ImprovementProposalHuSystemGeneration,
} from "@hu/types";

/**
 * Initiative Lifecycle — Part D, Section 4 (AI Draft Pipeline).
 *
 * Localization repair — HU system frames are structured
 * (`huSystemGeneration`) + WEB_UI composition at presentation.
 * Participant excerpts remain MANUAL_AUTHOR. Do not persist English glue
 * sentences that only get lifecycle-word substituted at render time.
 */

export interface GeneratedProposalDraftItem {
  readonly title: string;
  readonly summary: string;
  readonly description: string;
  readonly reason: string;
  readonly expectedImprovement: string;
  readonly supportingSources: string;
  readonly relatedDiscussionReferences: string;
  readonly originalAuthorDisplayNames: readonly string[];
  readonly sourceCommentIds: readonly string[];
  readonly groupId: string;
  readonly huSystemGeneration: ImprovementProposalHuSystemGeneration;
}

export interface ImprovementProposalDraftProviderInput {
  readonly snapshot: InitiativeProposalIntelligenceSnapshot;
  readonly existingGroupIds: ReadonlySet<string>;
}

export interface ImprovementProposalDraftProvider {
  readonly providerId: string;
  generateDraftProposals(input: ImprovementProposalDraftProviderInput): Promise<GeneratedProposalDraftItem[]>;
}

const DISCUSSION_STAGE = lifecycleStageToken("discussion");
const PROPOSAL_STAGE = lifecycleStageToken("proposal");
const INITIATIVE_STAGE = lifecycleStageToken("initiative");

function truncateForTitle(excerpt: string, maxLength = 72): string {
  const trimmed = excerpt.trim().replace(/[.?!…]+$/, "");
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 1)}…` : trimmed;
}

/**
 * Description body stores participant excerpts only (MANUAL_AUTHOR).
 * The "raised N times" frame is WEB_UI via huSystemGeneration.
 */
function buildDescriptionExcerpts(memberExcerpts: readonly string[]): string {
  if (memberExcerpts.length <= 1) {
    return memberExcerpts[0] ?? "";
  }
  return memberExcerpts.map((excerpt) => `- "${excerpt}"`).join("\n");
}

function buildHuSystemGeneration(
  group: InitiativeProposalGroup,
  memberExcerpts: readonly string[],
): ImprovementProposalHuSystemGeneration {
  return {
    descriptionKind: memberExcerpts.length > 1 ? "raised_times" : "single_excerpt",
    raisedCount: memberExcerpts.length,
    reasonKind: group.isDuplicateGroup ? "raised_independently" : "raised_by",
    participantCount: group.authorDisplayNames.length,
    category: group.category,
    discussionStageToken: DISCUSSION_STAGE,
    helpfulCount: group.totalHelpfulCount,
    memberCount: group.memberCount,
    supportingSourcesKind:
      group.totalHelpfulCount > 0 ? "helpful_reactions" : "related_comments",
  };
}

function generateDeterministicDraftProposals(
  input: ImprovementProposalDraftProviderInput,
): GeneratedProposalDraftItem[] {
  const generated: GeneratedProposalDraftItem[] = [];

  for (const group of input.snapshot.groups) {
    if (input.existingGroupIds.has(group.groupId)) {
      continue;
    }

    const memberExcerpts = [
      group.representativeExcerpt,
      ...input.snapshot.candidates
        .filter((candidate) => group.memberCandidateIds.includes(candidate.candidateId))
        .map((candidate) => candidate.excerpt)
        .filter((excerpt) => excerpt !== group.representativeExcerpt),
    ];

    const huSystemGeneration = buildHuSystemGeneration(group, memberExcerpts);

    generated.push({
      // Stage token + participant excerpt — CV localizes the stage; excerpt is MANUAL_AUTHOR.
      title: `${PROPOSAL_STAGE}: ${truncateForTitle(group.representativeExcerpt)}`,
      summary: group.representativeExcerpt,
      description: buildDescriptionExcerpts(memberExcerpts),
      // Empty — WEB_UI composes from huSystemGeneration (not English glue).
      reason: "",
      expectedImprovement: "",
      supportingSources: "",
      relatedDiscussionReferences: group.discussionUrl,
      originalAuthorDisplayNames: group.authorDisplayNames,
      sourceCommentIds: input.snapshot.candidates
        .filter((candidate) => group.memberCandidateIds.includes(candidate.candidateId))
        .map((candidate) => candidate.commentId),
      groupId: group.groupId,
      huSystemGeneration,
    });
  }

  return generated;
}

export const deterministicImprovementProposalDraftProvider: ImprovementProposalDraftProvider = {
  providerId: "deterministic-v1",
  generateDraftProposals: (input) => Promise.resolve(generateDeterministicDraftProposals(input)),
};

export function resolveImprovementProposalDraftProvider(): ImprovementProposalDraftProvider {
  return deterministicImprovementProposalDraftProvider;
}

export async function generateImprovementProposalDrafts(
  input: ImprovementProposalDraftProviderInput,
): Promise<GeneratedProposalDraftItem[]> {
  const provider = resolveImprovementProposalDraftProvider();
  return provider.generateDraftProposals(input);
}

export function toStructuredProposal(
  item: GeneratedProposalDraftItem,
  now: string,
): InitiativeStructuredProposal {
  return {
    proposalId: `initiative-structured-proposal-${randomUUID()}`,
    title: item.title,
    summary: item.summary,
    description: item.description,
    reason: item.reason,
    expectedImprovement: item.expectedImprovement,
    supportingSources: item.supportingSources,
    relatedDiscussionReferences: item.relatedDiscussionReferences,
    originalAuthorDisplayNames: item.originalAuthorDisplayNames,
    sourceCommentIds: item.sourceCommentIds,
    groupId: item.groupId,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    huSystemGeneration: item.huSystemGeneration,
  };
}

/** Exported for Closure 04 / tests — tokens used in deterministic HU-owned prose. */
export const IMPROVEMENT_PROPOSAL_DRAFT_STAGE_TOKENS = {
  discussion: DISCUSSION_STAGE,
  proposal: PROPOSAL_STAGE,
  initiative: INITIATIVE_STAGE,
} as const;

/** True when stored prose still contains banned English HU glue templates. */
export function improvementProposalContainsBannedEnglishGlue(text: string): boolean {
  return (
    /This idea was raised \d+ times in/i.test(text) ||
    /Raised independently by .+ in the .+ area of/i.test(text) ||
    /Raised by .+ in the .+ area of/i.test(text) ||
    /\d+ Helpful reaction\(s\) across/i.test(text)
  );
}
