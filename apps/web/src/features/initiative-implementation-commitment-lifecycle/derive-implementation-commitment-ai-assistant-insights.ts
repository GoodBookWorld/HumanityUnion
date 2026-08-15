import type {
  InitiativeImplementationCommitmentIntelligenceSnapshot,
  InitiativeImplementationCommitmentLifecycleDraft,
} from "@hu/types";

export interface ImplementationCommitmentAiAssistantInsights {
  sourcesUsedSummary: string;
  unassignedActionsWarnings: string[];
  overloadedRoleWarnings: string[];
  missingResourcesWarnings: string[];
  emptyTimelineWarnings: string[];
  unresolvedRisksWarnings: string[];
  clarityWarnings: string[];
}

/**
 * Initiative Lifecycle — Part I, Section 4. Advisory-only derived
 * insights — never itself assigns a Participant, edits a Candidate, or
 * publishes. Every Candidate field it inspects mirrors what the Author can
 * already see and edit directly in the Editor.
 */
export function deriveImplementationCommitmentAiAssistantInsights(
  snapshot: InitiativeImplementationCommitmentIntelligenceSnapshot,
  draft: InitiativeImplementationCommitmentLifecycleDraft | null,
): ImplementationCommitmentAiAssistantInsights {
  const unassignedActionsWarnings: string[] = [];
  const overloadedRoleWarnings: string[] = [];
  const missingResourcesWarnings: string[] = [];
  const emptyTimelineWarnings: string[] = [];
  const unresolvedRisksWarnings: string[] = [];
  const clarityWarnings: string[] = [];

  if (!snapshot.decisionReference) {
    unassignedActionsWarnings.push(
      "Publish a Collective Decision before generating Implementation Commitments.",
    );
  }

  if (draft) {
    if (draft.candidates.length === 0) {
      unassignedActionsWarnings.push(
        "No Commitment Candidates yet — generate a draft from the Collective Decision's Approved Actions.",
      );
    }

    const unassigned = draft.candidates.filter((candidate) => !candidate.proposedParticipantId);
    if (unassigned.length > 0) {
      unassignedActionsWarnings.push(
        `${unassigned.length} Candidate(s) have no proposed Participant yet.`,
      );
    }

    const roleCounts = new Map<string, number>();
    for (const candidate of draft.candidates) {
      const role = candidate.suggestedResponsibleRole.trim();
      if (!role) {
        continue;
      }
      roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1);
    }
    for (const [role, count] of roleCounts) {
      if (count > 2) {
        overloadedRoleWarnings.push(`Role "${role}" is suggested for ${count} Candidates — consider spreading responsibility.`);
      }
    }

    const missingResources = draft.candidates.filter((candidate) => candidate.requiredResources.length === 0);
    if (missingResources.length > 0) {
      missingResourcesWarnings.push(
        `${missingResources.length} Candidate(s) list no Required Resources.`,
      );
    }

    const missingTimeline = draft.candidates.filter((candidate) => !candidate.suggestedTimeline.trim());
    if (missingTimeline.length > 0) {
      emptyTimelineWarnings.push(
        `${missingTimeline.length} Candidate(s) have no Suggested Timeline.`,
      );
    }

    const missingRisks = draft.candidates.filter((candidate) => candidate.relatedRisks.length === 0);
    if (missingRisks.length > 0) {
      unresolvedRisksWarnings.push(`${missingRisks.length} Candidate(s) list no Related Risks.`);
    }

    if (!draft.title.trim()) {
      clarityWarnings.push("Title is empty — Implementation Commitments should be clearly labeled.");
    }

    if (!draft.summary.trim()) {
      clarityWarnings.push("Summary is empty — restate the Collective Decision's implementation intent.");
    }
  }

  for (const check of snapshot.consistencyChecks) {
    if (check.status === "warning") {
      clarityWarnings.push(check.detail);
    }
  }

  const sourcesUsedSummary = [
    snapshot.decisionReference ? `Collective Decision "${snapshot.decisionReference.title}"` : null,
    `${snapshot.activeAllyCount} Active Ally(ies)`,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    sourcesUsedSummary: sourcesUsedSummary || "No Implementation Commitment Sources available yet.",
    unassignedActionsWarnings,
    overloadedRoleWarnings,
    missingResourcesWarnings,
    emptyTimelineWarnings,
    unresolvedRisksWarnings,
    clarityWarnings,
  };
}
