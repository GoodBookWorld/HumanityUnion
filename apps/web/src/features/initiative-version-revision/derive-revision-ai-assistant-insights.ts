import type { InitiativeRevisionChange, InitiativeRevisionIntelligenceSnapshot } from "@hu/types";

import type { RevisionSidebarAdvisory } from "../initiative-lifecycle-stage-workspace/sidebar-advisory-contract";

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
 *
 * Pack 02G Task 08E.8c: Web-owned deterministic advisory meaning is encoded
 * as language-neutral descriptors. API conflict/consistency prose remains
 * opaque pass-through data and is never converted into Web advisory codes.
 */
export interface RevisionAiAssistantInsights {
  readonly sourcesSummary: RevisionSidebarAdvisory;
  readonly unresolvedProposalCount: number;
  readonly missingReferenceProposalIds: readonly string[];
  /** API opaque conflict warnings — message/detail stay raw. */
  readonly conflictWarnings: InitiativeRevisionIntelligenceSnapshot["conflictWarnings"];
  /**
   * Filtered API consistency checks (status === "warning").
   * Currently unmounted in Working Sidebar — INTERNAL_UNUSED presentation debt.
   * Kept for derive contract continuity; do not localize.
   */
  readonly consistencyWarnings: InitiativeRevisionIntelligenceSnapshot["consistencyChecks"];
  readonly untracedChanges: readonly InitiativeRevisionChange[];
  readonly analysisAlignment: RevisionSidebarAdvisory;
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
  const sourcesSummary: RevisionSidebarAdvisory =
    snapshot.eligibleProposals.length > 0
      ? {
          code: "revision.sources.summary",
          severity: "info",
          params: {
            eligibleCount: snapshot.eligibleProposals.length,
            unresolvedCount: snapshot.unresolvedProposalIds.length,
          },
        }
      : {
          code: "revision.sources.empty",
          severity: "info",
        };

  const analysisAlignment: RevisionSidebarAdvisory = snapshot.analysisReference
    ? {
        code: "revision.alignment.with_analysis",
        severity: "info",
        civic: { title: snapshot.analysisReference.title },
      }
    : {
        code: "revision.alignment.no_analysis",
        severity: "info",
      };

  return {
    sourcesSummary,
    unresolvedProposalCount: snapshot.unresolvedProposalIds.length,
    missingReferenceProposalIds: snapshot.missingReferenceProposalIds,
    conflictWarnings: snapshot.conflictWarnings,
    consistencyWarnings: snapshot.consistencyChecks.filter((check) => check.status === "warning"),
    untracedChanges: draftChanges.filter((change) => !isTracedChange(change)),
    analysisAlignment,
  };
}
