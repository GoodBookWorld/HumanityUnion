import { randomUUID } from "node:crypto";

import type { InitiativeProposalGroup, InitiativeProposalIntelligenceSnapshot, InitiativeStructuredProposal } from "@hu/types";

/**
 * Initiative Lifecycle — Part D, Section 2/4 (Automatic Proposal
 * Collection → Author Editing seam).
 *
 * Mirrors the provider-independence pattern from
 * `initiative-analysis-draft-builder.ts` (Part B / Part C's "Future AI
 * Providers"): a small interface + a deterministic reference
 * implementation + one resolution function, so a future AI provider can
 * be swapped in later without any caller changing.
 *
 * Unlike Collaborative Analysis's single-document draft (where
 * "Generate" always overwrites the one draft wholesale), this stage
 * drafts MANY independent structured proposals — one per detected group.
 * Overwriting every existing proposal on every Generate call would
 * destroy Author edits already made to previously-reviewed proposals, so
 * this provider is deliberately ENRICHING, not replacing: it returns one
 * new draft item for every group that does not already have a backing
 * proposal (matched by `groupId`), and the caller (the collection
 * service) only ever appends these — it never touches an existing
 * proposal's fields. This is a direct application of Part C's Universal
 * AI Principle "never changes content autonomously" — a still-untouched
 * group becomes a NEW draft, it never silently rewrites an Author's
 * already-drafted proposal for the same group.
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
}

export interface ImprovementProposalDraftProviderInput {
  readonly snapshot: InitiativeProposalIntelligenceSnapshot;
  readonly existingGroupIds: ReadonlySet<string>;
}

export interface ImprovementProposalDraftProvider {
  readonly providerId: string;
  generateDraftProposals(input: ImprovementProposalDraftProviderInput): Promise<GeneratedProposalDraftItem[]>;
}

function truncateForTitle(excerpt: string, maxLength = 72): string {
  const trimmed = excerpt.trim().replace(/[.?!…]+$/, "");
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 1)}…` : trimmed;
}

function buildDescription(group: InitiativeProposalGroup, memberExcerpts: readonly string[]): string {
  if (memberExcerpts.length <= 1) {
    return group.representativeExcerpt;
  }

  const bullets = memberExcerpts.map((excerpt) => `- "${excerpt}"`).join("\n");
  return `This idea was raised ${memberExcerpts.length} times in Discussion, in similar words:\n${bullets}`;
}

function buildReason(group: InitiativeProposalGroup): string {
  const authorCount = group.authorDisplayNames.length;
  const participantsLabel = authorCount === 1 ? "1 participant" : `${authorCount} participants`;

  return group.isDuplicateGroup
    ? `Raised independently by ${participantsLabel} in the ${group.category} area of Discussion — repetition suggests shared concern.`
    : `Raised by ${participantsLabel} in the ${group.category} area of Discussion.`;
}

function buildSupportingSources(group: InitiativeProposalGroup): string {
  return group.totalHelpfulCount > 0
    ? `${group.totalHelpfulCount} Helpful reaction(s) across ${group.memberCount} related comment(s) in Discussion.`
    : `${group.memberCount} related comment(s) in Discussion (no Helpful reactions recorded yet).`;
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

    generated.push({
      title: `Proposal: ${truncateForTitle(group.representativeExcerpt)}`,
      summary: group.representativeExcerpt,
      description: buildDescription(group, memberExcerpts),
      reason: buildReason(group),
      expectedImprovement:
        "Describe the concrete improvement this change is expected to deliver for the Initiative.",
      supportingSources: buildSupportingSources(group),
      relatedDiscussionReferences: group.discussionUrl,
      originalAuthorDisplayNames: group.authorDisplayNames,
      sourceCommentIds: input.snapshot.candidates
        .filter((candidate) => group.memberCandidateIds.includes(candidate.candidateId))
        .map((candidate) => candidate.commentId),
      groupId: group.groupId,
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

/** Converts a freshly generated draft item into a persistable `InitiativeStructuredProposal`, assigning its permanent, stable `proposalId` (Part 7). */
export function toStructuredProposal(item: GeneratedProposalDraftItem, now: string): InitiativeStructuredProposal {
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
  };
}
