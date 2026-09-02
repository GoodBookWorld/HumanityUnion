import type {
  InitiativeCollectiveDecisionIntelligenceSnapshot,
  InitiativeCollectiveDecisionLifecycleDraft,
} from "@hu/types";

import type { CollectiveDecisionSidebarAdvisory } from "../initiative-lifecycle-stage-workspace/sidebar-advisory-contract";

/**
 * Initiative Lifecycle — Part H Decision Assistant insights.
 *
 * Pack 02G Task 08E.8d: Web-owned deterministic advisory meaning is encoded as
 * language-neutral descriptors. API consistency-check detail remains opaque
 * pass-through data and is never converted into Web advisory codes.
 */
export interface CollectiveDecisionAiAssistantInsights {
  readonly sourcesSummary: CollectiveDecisionSidebarAdvisory;
  readonly missingActionsWarnings: readonly CollectiveDecisionSidebarAdvisory[];
  readonly duplicatedActionsWarnings: readonly CollectiveDecisionSidebarAdvisory[];
  readonly missingRolesWarnings: readonly CollectiveDecisionSidebarAdvisory[];
  readonly unrealisticTimelineWarnings: readonly CollectiveDecisionSidebarAdvisory[];
  readonly unresolvedRisksWarnings: readonly CollectiveDecisionSidebarAdvisory[];
  readonly missingSuccessCriteriaWarnings: readonly CollectiveDecisionSidebarAdvisory[];
  readonly unsupportedConclusionsWarnings: readonly CollectiveDecisionSidebarAdvisory[];
  readonly clarityWarnings: readonly CollectiveDecisionSidebarAdvisory[];
  /** API opaque consistency warnings — detail/label stay raw. */
  readonly consistencyWarnings: InitiativeCollectiveDecisionIntelligenceSnapshot["consistencyChecks"];
}

export function deriveCollectiveDecisionAiAssistantInsights(
  snapshot: InitiativeCollectiveDecisionIntelligenceSnapshot,
  draft: InitiativeCollectiveDecisionLifecycleDraft | null,
  _lifecycleProfile?: string | null,
): CollectiveDecisionAiAssistantInsights {
  const missingActionsWarnings: CollectiveDecisionSidebarAdvisory[] = [];
  const duplicatedActionsWarnings: CollectiveDecisionSidebarAdvisory[] = [];
  const missingRolesWarnings: CollectiveDecisionSidebarAdvisory[] = [];
  const unrealisticTimelineWarnings: CollectiveDecisionSidebarAdvisory[] = [];
  const unresolvedRisksWarnings: CollectiveDecisionSidebarAdvisory[] = [];
  const missingSuccessCriteriaWarnings: CollectiveDecisionSidebarAdvisory[] = [];
  const unsupportedConclusionsWarnings: CollectiveDecisionSidebarAdvisory[] = [];
  const clarityWarnings: CollectiveDecisionSidebarAdvisory[] = [];

  // Decision Session is SOURCE_OPTIONAL — never hard-warn Authors to publish it first.

  if (draft) {
    if (draft.approvedActions.length === 0) {
      missingActionsWarnings.push({
        code: "collective_decision.actions.need_one",
        severity: "warning",
        civic: { collectiveDecisionFieldIds: ["approvedActions"] },
      });
    }

    const normalized = draft.approvedActions.map((action) => action.trim().toLowerCase());
    const duplicates = normalized.filter(
      (action, index) => action && normalized.indexOf(action) !== index,
    );
    if (duplicates.length > 0) {
      duplicatedActionsWarnings.push({
        code: "collective_decision.actions.duplicated",
        severity: "warning",
        civic: { collectiveDecisionFieldIds: ["approvedActions"] },
      });
    }

    if (draft.responsibleRoles.length === 0) {
      missingRolesWarnings.push({
        code: "collective_decision.roles.none",
        severity: "warning",
        civic: { collectiveDecisionFieldIds: ["roles"] },
      });
    }

    if (!draft.implementationTimeline.trim()) {
      unrealisticTimelineWarnings.push({
        code: "collective_decision.timeline.empty",
        severity: "warning",
        civic: { collectiveDecisionFieldIds: ["timeline"] },
      });
    }

    if (draft.decisionRisks.length === 0) {
      unresolvedRisksWarnings.push({
        code: "collective_decision.risks.none",
        severity: "warning",
        civic: { collectiveDecisionFieldIds: ["risks"] },
      });
    }

    if (draft.successCriteria.length === 0) {
      missingSuccessCriteriaWarnings.push({
        code: "collective_decision.criteria.none",
        severity: "warning",
        civic: { collectiveDecisionFieldIds: ["criteria"] },
      });
    }

    if (!draft.decisionRationale.trim()) {
      unsupportedConclusionsWarnings.push({
        code: "collective_decision.rationale.empty",
        severity: "warning",
        civic: { collectiveDecisionFieldIds: ["rationale"] },
      });
    }

    if (!draft.decisionSummary.trim() || draft.decisionSummary.length < 20) {
      clarityWarnings.push({
        code: "collective_decision.clarity.summary_unclear",
        severity: "warning",
        civic: { collectiveDecisionFieldIds: ["summary"] },
      });
    }
  }

  const hasDecisionSession = Boolean(snapshot.decisionSessionReference);
  const hasPetition = Boolean(snapshot.petitionReference);
  const hasRevision = Boolean(snapshot.revisionReference);
  const hasAnalysis = Boolean(snapshot.analysisReference);
  const proposalCount = snapshot.proposalReferences.length;
  const hasAnySource =
    hasDecisionSession || hasPetition || hasRevision || hasAnalysis || proposalCount > 0;

  const sourcesSummary: CollectiveDecisionSidebarAdvisory = hasAnySource
    ? {
        code: "collective_decision.sources.summary",
        severity: "info",
        params: {
          hasDecisionSession: hasDecisionSession ? 1 : 0,
          hasPetition: hasPetition ? 1 : 0,
          hasRevision: hasRevision ? 1 : 0,
          revisionVersion: snapshot.revisionReference?.version ?? 0,
          hasAnalysis: hasAnalysis ? 1 : 0,
          proposalCount,
        },
      }
    : {
        code: "collective_decision.sources.empty",
        severity: "info",
      };

  return {
    sourcesSummary,
    missingActionsWarnings,
    duplicatedActionsWarnings,
    missingRolesWarnings,
    unrealisticTimelineWarnings,
    unresolvedRisksWarnings,
    missingSuccessCriteriaWarnings,
    unsupportedConclusionsWarnings,
    clarityWarnings,
    consistencyWarnings: snapshot.consistencyChecks.filter((check) => check.status === "warning"),
  };
}
