import type {
  InitiativeImplementationCommitmentIntelligenceSnapshot,
  InitiativeImplementationCommitmentLifecycleDraft,
} from "@hu/types";

import type { ImplementationCommitmentSidebarAdvisory } from "../initiative-lifecycle-stage-workspace/sidebar-advisory-contract";

export interface ImplementationCommitmentAiAssistantInsights {
  readonly sourcesSummary: ImplementationCommitmentSidebarAdvisory;
  readonly unassignedActionsWarnings: readonly ImplementationCommitmentSidebarAdvisory[];
  readonly overloadedRoleWarnings: readonly ImplementationCommitmentSidebarAdvisory[];
  readonly missingResourcesWarnings: readonly ImplementationCommitmentSidebarAdvisory[];
  readonly emptyTimelineWarnings: readonly ImplementationCommitmentSidebarAdvisory[];
  readonly unresolvedRisksWarnings: readonly ImplementationCommitmentSidebarAdvisory[];
  readonly clarityWarnings: readonly ImplementationCommitmentSidebarAdvisory[];
  /** API opaque consistency warnings — detail/label stay raw. */
  readonly consistencyWarnings: InitiativeImplementationCommitmentIntelligenceSnapshot["consistencyChecks"];
}

/**
 * Initiative Lifecycle — Part I, Section 4. Advisory-only derived
 * insights — never itself assigns a Participant, edits a Candidate, or
 * publishes. Every Candidate field it inspects mirrors what the Author can
 * already see and edit directly in the Editor.
 *
 * Pack 02G Task 08E.8e: Web-owned deterministic advisory meaning is encoded as
 * language-neutral descriptors. API consistency-check detail remains opaque.
 */
export function deriveImplementationCommitmentAiAssistantInsights(
  snapshot: InitiativeImplementationCommitmentIntelligenceSnapshot,
  draft: InitiativeImplementationCommitmentLifecycleDraft | null,
): ImplementationCommitmentAiAssistantInsights {
  const unassignedActionsWarnings: ImplementationCommitmentSidebarAdvisory[] = [];
  const overloadedRoleWarnings: ImplementationCommitmentSidebarAdvisory[] = [];
  const missingResourcesWarnings: ImplementationCommitmentSidebarAdvisory[] = [];
  const emptyTimelineWarnings: ImplementationCommitmentSidebarAdvisory[] = [];
  const unresolvedRisksWarnings: ImplementationCommitmentSidebarAdvisory[] = [];
  const clarityWarnings: ImplementationCommitmentSidebarAdvisory[] = [];

  if (!snapshot.decisionReference) {
    unassignedActionsWarnings.push({
      code: "implementation_commitment.unassigned.decision_required",
      severity: "warning",
    });
  }

  if (draft) {
    if (draft.candidates.length === 0) {
      unassignedActionsWarnings.push({
        code: "implementation_commitment.unassigned.no_candidates",
        severity: "warning",
      });
    }

    const unassigned = draft.candidates.filter((candidate) => !candidate.proposedParticipantId);
    if (unassigned.length > 0) {
      unassignedActionsWarnings.push({
        code: "implementation_commitment.unassigned.missing_participants",
        severity: "warning",
        params: { count: unassigned.length },
      });
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
        overloadedRoleWarnings.push({
          code: "implementation_commitment.roles.overloaded",
          severity: "warning",
          params: { count },
          civic: { role },
        });
      }
    }

    const missingResources = draft.candidates.filter((candidate) => candidate.requiredResources.length === 0);
    if (missingResources.length > 0) {
      missingResourcesWarnings.push({
        code: "implementation_commitment.resources.missing",
        severity: "warning",
        params: { count: missingResources.length },
      });
    }

    const missingTimeline = draft.candidates.filter((candidate) => !candidate.suggestedTimeline.trim());
    if (missingTimeline.length > 0) {
      emptyTimelineWarnings.push({
        code: "implementation_commitment.timeline.missing",
        severity: "warning",
        params: { count: missingTimeline.length },
      });
    }

    const missingRisks = draft.candidates.filter((candidate) => candidate.relatedRisks.length === 0);
    if (missingRisks.length > 0) {
      unresolvedRisksWarnings.push({
        code: "implementation_commitment.risks.missing",
        severity: "warning",
        params: { count: missingRisks.length },
      });
    }

    if (!draft.title.trim()) {
      clarityWarnings.push({
        code: "implementation_commitment.clarity.title_empty",
        severity: "warning",
        civic: { implementationCommitmentFieldIds: ["title"] },
      });
    }

    if (!draft.summary.trim()) {
      clarityWarnings.push({
        code: "implementation_commitment.clarity.summary_empty",
        severity: "warning",
        civic: { implementationCommitmentFieldIds: ["summary"] },
      });
    }
  }

  const hasDecision = Boolean(snapshot.decisionReference);
  const sourcesSummary: ImplementationCommitmentSidebarAdvisory =
    hasDecision || snapshot.activeAllyCount >= 0
      ? {
          code: "implementation_commitment.sources.summary",
          severity: "info",
          params: {
            hasDecision: hasDecision ? 1 : 0,
            activeAllyCount: snapshot.activeAllyCount,
          },
          civic: snapshot.decisionReference
            ? { title: snapshot.decisionReference.title }
            : undefined,
        }
      : {
          code: "implementation_commitment.sources.empty",
          severity: "info",
        };

  return {
    sourcesSummary,
    unassignedActionsWarnings,
    overloadedRoleWarnings,
    missingResourcesWarnings,
    emptyTimelineWarnings,
    unresolvedRisksWarnings,
    clarityWarnings,
    consistencyWarnings: snapshot.consistencyChecks.filter((check) => check.status === "warning"),
  };
}
