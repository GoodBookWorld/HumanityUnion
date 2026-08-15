import type { InitiativeRevisionChange, InitiativeRevisionIntelligenceSnapshot } from "@hu/types";

/**
 * Initiative Lifecycle — Part E, Section 3/4 (Revision Intelligence /
 * Revision Assistant).
 *
 * Every field here is a deterministic derivation of the already-fetched
 * `InitiativeRevisionIntelligenceSnapshot` plus the Author's own current
 * draft changes — no AI chat, no external call, no invented category.
 * Mirrors `derive-proposal-ai-assistant-insights.ts` (Part D): the
 * Assistant only ever surfaces what the deterministic Revision Builder
 * already found (checking consistency, finding contradictions,
 * highlighting unresolved proposals, checking alignment with Analysis and
 * accepted Proposals) and NEVER edits automatically (Section 4 — the
 * Author always confirms changes, enforced server-side, not merely hidden
 * here).
 */
export interface RevisionAiAssistantInsights {
  readonly sourcesUsedSummary: string;
  readonly unresolvedProposalCount: number;
  readonly missingReferenceProposalIds: readonly string[];
  readonly conflictWarnings: InitiativeRevisionIntelligenceSnapshot["conflictWarnings"];
  readonly consistencyWarnings: InitiativeRevisionIntelligenceSnapshot["consistencyChecks"];
  readonly untracedChanges: readonly InitiativeRevisionChange[];
  readonly analysisAlignmentSummary: string;
}

function isTracedChange(change: InitiativeRevisionChange): boolean {
  return (
    change.proposalIds.length > 0 ||
    (change.origin === "author_originated" && Boolean(change.authorOriginatedReason?.trim()))
  );
}

export function deriveRevisionAiAssistantInsights(
  snapshot: InitiativeRevisionIntelligenceSnapshot,
  draftChanges: readonly InitiativeRevisionChange[],
): RevisionAiAssistantInsights {
  return {
    sourcesUsedSummary:
      snapshot.eligibleProposals.length > 0
        ? `${snapshot.eligibleProposals.length} published Improvement Proposal(s), ${snapshot.unresolvedProposalIds.length} unresolved.`
        : "No published Improvement Proposals collected yet.",
    unresolvedProposalCount: snapshot.unresolvedProposalIds.length,
    missingReferenceProposalIds: snapshot.missingReferenceProposalIds,
    conflictWarnings: snapshot.conflictWarnings,
    consistencyWarnings: snapshot.consistencyChecks.filter((check) => check.status === "warning"),
    untracedChanges: draftChanges.filter((change) => !isTracedChange(change)),
    analysisAlignmentSummary: snapshot.analysisReference
      ? `Aligned with published Collaborative Analysis: "${snapshot.analysisReference.title}".`
      : "No published Collaborative Analysis to align with yet.",
  };
}
