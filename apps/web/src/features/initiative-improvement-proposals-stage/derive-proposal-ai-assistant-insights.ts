import type {
  InitiativeProposalGroup,
  InitiativeProposalIntelligenceSnapshot,
  InitiativeStructuredProposal,
} from "@hu/types";

/**
 * Initiative Lifecycle — Part D, Section 3/4 (Proposal Intelligence / AI
 * Assistant).
 *
 * Every field here is a deterministic derivation of the already-fetched
 * `InitiativeProposalIntelligenceSnapshot` plus the Author's own current
 * draft proposals — no AI chat, no external call, no invented category.
 * This mirrors `derive-ai-assistant-insights.ts` (Collaborative Analysis,
 * Part B): the assistant only ever surfaces what the deterministic
 * grouping/duplicate-detection pass already found (Part 2/3) — merge
 * suggestions, missing-detail flags, ungrouped candidates — and NEVER
 * decides Accepted/Rejected/Included/Excluded/Priority (Part 4: those
 * remain Author decisions, enforced entirely server-side by the status
 * validators, not merely hidden here).
 */
export interface ProposalAiAssistantInsights {
  readonly sourcesUsedSummary: string;
  readonly duplicateGroups: readonly InitiativeProposalGroup[];
  readonly ungroupedCandidateGroups: readonly InitiativeProposalGroup[];
  readonly incompleteProposals: readonly { readonly proposal: InitiativeStructuredProposal; readonly missingFields: readonly string[] }[];
  readonly openProposalQuestionCount: number;
}

const REQUIRED_FIELDS: Array<[keyof InitiativeStructuredProposal, string]> = [
  ["title", "Title"],
  ["summary", "Summary"],
  ["description", "Description"],
  ["reason", "Reason"],
  ["expectedImprovement", "Expected Improvement"],
];

function findMissingFields(proposal: InitiativeStructuredProposal): string[] {
  return REQUIRED_FIELDS.filter(([field]) => {
    const value = proposal[field];
    return typeof value !== "string" || value.trim().length === 0;
  }).map(([, label]) => label);
}

export function deriveProposalAiAssistantInsights(
  snapshot: InitiativeProposalIntelligenceSnapshot,
  draftProposals: readonly InitiativeStructuredProposal[],
): ProposalAiAssistantInsights {
  const backedGroupIds = new Set(
    draftProposals.map((proposal) => proposal.groupId).filter((groupId): groupId is string => groupId !== null),
  );

  const duplicateGroups = snapshot.groups.filter((group) => group.isDuplicateGroup);
  const ungroupedCandidateGroups = snapshot.groups.filter((group) => !backedGroupIds.has(group.groupId));
  const incompleteProposals = draftProposals
    .map((proposal) => ({ proposal, missingFields: findMissingFields(proposal) }))
    .filter((entry) => entry.missingFields.length > 0);

  return {
    sourcesUsedSummary:
      snapshot.totalCandidateCount > 0
        ? `${snapshot.totalCandidateCount} proposal-marked comment(s) across ${snapshot.groups.length} group(s), ${snapshot.duplicateGroupCount} likely duplicate.`
        : "No proposal-marked comments collected yet.",
    duplicateGroups,
    ungroupedCandidateGroups,
    incompleteProposals,
    openProposalQuestionCount: snapshot.openProposalQuestions.length,
  };
}
