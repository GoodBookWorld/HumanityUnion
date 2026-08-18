import type {
  InitiativeCollectiveDecisionIntelligenceSnapshot,
  InitiativeCollectiveDecisionLifecycleDraft,
  InitiativeLifecycleProfile,
} from "@hu/types";

import { requiresDecisionSessionBeforeCollectiveDecision } from "../public-initiative-experience/initiative-lifecycle-shell";

export interface CollectiveDecisionAiAssistantInsights {
  sourcesUsedSummary: string;
  missingActionsWarnings: string[];
  duplicatedActionsWarnings: string[];
  missingRolesWarnings: string[];
  unrealisticTimelineWarnings: string[];
  unresolvedRisksWarnings: string[];
  missingSuccessCriteriaWarnings: string[];
  unsupportedConclusionsWarnings: string[];
  clarityWarnings: string[];
}

export function deriveCollectiveDecisionAiAssistantInsights(
  snapshot: InitiativeCollectiveDecisionIntelligenceSnapshot,
  draft: InitiativeCollectiveDecisionLifecycleDraft | null,
  lifecycleProfile?: InitiativeLifecycleProfile | string | null,
): CollectiveDecisionAiAssistantInsights {
  const missingActionsWarnings: string[] = [];
  const duplicatedActionsWarnings: string[] = [];
  const missingRolesWarnings: string[] = [];
  const unrealisticTimelineWarnings: string[] = [];
  const unresolvedRisksWarnings: string[] = [];
  const missingSuccessCriteriaWarnings: string[] = [];
  const unsupportedConclusionsWarnings: string[] = [];
  const clarityWarnings: string[] = [];
  const requireDecisionSession = requiresDecisionSessionBeforeCollectiveDecision(lifecycleProfile);

  if (requireDecisionSession && !snapshot.decisionSessionReference) {
    missingActionsWarnings.push("Publish a Decision Session before generating Decision actions.");
  }

  if (draft) {
    if (draft.approvedActions.length === 0) {
      missingActionsWarnings.push("Add at least one Approved Action so the Collective Decision has a clear outcome.");
    }

    const normalized = draft.approvedActions.map((action) => action.trim().toLowerCase());
    const duplicates = normalized.filter((action, index) => action && normalized.indexOf(action) !== index);
    if (duplicates.length > 0) {
      duplicatedActionsWarnings.push("Some Approved Actions appear duplicated — consolidate before publishing.");
    }

    if (draft.responsibleRoles.length === 0) {
      missingRolesWarnings.push("No Responsible Roles listed — identify who is accountable for implementation.");
    }

    if (!draft.implementationTimeline.trim()) {
      unrealisticTimelineWarnings.push("Implementation Timeline is empty — implementation timing will be unclear.");
    }

    if (draft.decisionRisks.length === 0) {
      unresolvedRisksWarnings.push("No Decision Risks listed — surface implementation risks before publish.");
    }

    if (draft.successCriteria.length === 0) {
      missingSuccessCriteriaWarnings.push("No Success Criteria listed — define what a successful outcome looks like.");
    }

    if (!draft.decisionRationale.trim()) {
      unsupportedConclusionsWarnings.push(
        requireDecisionSession
          ? "Decision Rationale is empty — cite the Decision Session's supporting arguments."
          : "Decision Rationale is empty — explain why this Collective Decision outcome follows from upstream sources.",
      );
    }

    if (!draft.decisionSummary.trim() || draft.decisionSummary.length < 20) {
      clarityWarnings.push(
        requireDecisionSession
          ? "Decision Summary should clearly restate the Decision Session question and purpose."
          : "Decision Summary should clearly state the Collective Decision outcome and purpose.",
      );
    }
  }

  for (const check of snapshot.consistencyChecks) {
    if (check.status === "warning") {
      clarityWarnings.push(check.detail);
    }
  }

  const sourcesUsedSummary = [
    snapshot.decisionSessionReference
      ? requireDecisionSession
        ? "Published Decision Session"
        : "Decision Session (optional)"
      : null,
    snapshot.petitionReference ? "Published Petition" : null,
    snapshot.revisionReference ? `Revision v${snapshot.revisionReference.version}` : null,
    snapshot.analysisReference ? "Collaborative Analysis" : null,
    snapshot.proposalReferences.length > 0
      ? `${snapshot.proposalReferences.length} Proposal(s)`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    sourcesUsedSummary: sourcesUsedSummary || "No Decision Sources available yet.",
    missingActionsWarnings,
    duplicatedActionsWarnings,
    missingRolesWarnings,
    unrealisticTimelineWarnings,
    unresolvedRisksWarnings,
    missingSuccessCriteriaWarnings,
    unsupportedConclusionsWarnings,
    clarityWarnings,
  };
}
