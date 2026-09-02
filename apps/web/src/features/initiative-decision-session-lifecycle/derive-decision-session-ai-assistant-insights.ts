import type {
  InitiativeDecisionSessionDraft,
  InitiativeDecisionSessionIntelligenceSnapshot,
} from "@hu/types";

import type { DecisionSessionSidebarAdvisory } from "../initiative-lifecycle-stage-workspace/sidebar-advisory-contract";

/**
 * Initiative Lifecycle — Part G Decision Assistant insights.
 *
 * Pack 02G Task 08E.8d: Web-owned deterministic advisory meaning is encoded as
 * language-neutral descriptors. API consistency-check detail remains opaque
 * pass-through data and is never converted into Web advisory codes.
 */
export interface DecisionSessionAiAssistantInsights {
  readonly sourcesSummary: DecisionSessionSidebarAdvisory;
  readonly missingOptionsWarnings: readonly DecisionSessionSidebarAdvisory[];
  readonly duplicatedOptionsWarnings: readonly DecisionSessionSidebarAdvisory[];
  readonly unsupportedArgumentWarnings: readonly DecisionSessionSidebarAdvisory[];
  readonly riskVisibilityWarnings: readonly DecisionSessionSidebarAdvisory[];
  readonly feasibilityWarnings: readonly DecisionSessionSidebarAdvisory[];
  readonly clarityWarnings: readonly DecisionSessionSidebarAdvisory[];
  /** API opaque consistency warnings — detail/label stay raw. */
  readonly consistencyWarnings: InitiativeDecisionSessionIntelligenceSnapshot["consistencyChecks"];
}

export function deriveDecisionSessionAiAssistantInsights(
  snapshot: InitiativeDecisionSessionIntelligenceSnapshot,
  draft: InitiativeDecisionSessionDraft | null,
): DecisionSessionAiAssistantInsights {
  const missingOptionsWarnings: DecisionSessionSidebarAdvisory[] = [];
  const duplicatedOptionsWarnings: DecisionSessionSidebarAdvisory[] = [];
  const unsupportedArgumentWarnings: DecisionSessionSidebarAdvisory[] = [];
  const riskVisibilityWarnings: DecisionSessionSidebarAdvisory[] = [];
  const feasibilityWarnings: DecisionSessionSidebarAdvisory[] = [];
  const clarityWarnings: DecisionSessionSidebarAdvisory[] = [];

  if (!snapshot.petitionReference) {
    missingOptionsWarnings.push({
      code: "decision_session.options.petition_required",
      severity: "warning",
    });
  }

  if (draft) {
    if (draft.options.length < 2) {
      missingOptionsWarnings.push({
        code: "decision_session.options.need_two",
        severity: "warning",
        civic: { decisionSessionFieldIds: ["options"] },
      });
    }

    const normalized = draft.options.map((option) => option.trim().toLowerCase());
    const duplicates = normalized.filter((option, index) => option && normalized.indexOf(option) !== index);
    if (duplicates.length > 0) {
      duplicatedOptionsWarnings.push({
        code: "decision_session.options.duplicated",
        severity: "warning",
        civic: { decisionSessionFieldIds: ["options"] },
      });
    }

    if (draft.supportingArguments.length === 0) {
      unsupportedArgumentWarnings.push({
        code: "decision_session.arguments.none",
        severity: "warning",
        civic: { decisionSessionFieldIds: ["arguments"] },
      });
    }

    if (draft.risks.length === 0) {
      riskVisibilityWarnings.push({
        code: "decision_session.risks.none",
        severity: "warning",
        civic: { decisionSessionFieldIds: ["risks"] },
      });
    }

    if (!draft.suggestedTimeline.trim()) {
      feasibilityWarnings.push({
        code: "decision_session.feasibility.timeline_empty",
        severity: "warning",
        civic: { decisionSessionFieldIds: ["timeline"] },
      });
    }

    if (draft.suggestedResponsibleRoles.length === 0) {
      feasibilityWarnings.push({
        code: "decision_session.feasibility.roles_none",
        severity: "warning",
        civic: { decisionSessionFieldIds: ["roles"] },
      });
    }

    if (!draft.decisionQuestion.trim() || draft.decisionQuestion.length < 20) {
      clarityWarnings.push({
        code: "decision_session.clarity.question_unclear",
        severity: "warning",
        civic: { decisionSessionFieldIds: ["question"] },
      });
    }
  }

  const hasPetition = Boolean(snapshot.petitionReference);
  const hasRevision = Boolean(snapshot.revisionReference);
  const hasAnalysis = Boolean(snapshot.analysisReference);
  const proposalCount = snapshot.proposalReferences.length;
  const allyRecommendationCount = snapshot.allyRecommendations.length;
  const hasAnySource =
    hasPetition || hasRevision || hasAnalysis || proposalCount > 0 || allyRecommendationCount > 0;

  const sourcesSummary: DecisionSessionSidebarAdvisory = hasAnySource
    ? {
        code: "decision_session.sources.summary",
        severity: "info",
        params: {
          hasPetition: hasPetition ? 1 : 0,
          hasRevision: hasRevision ? 1 : 0,
          revisionVersion: snapshot.revisionReference?.version ?? 0,
          hasAnalysis: hasAnalysis ? 1 : 0,
          proposalCount,
          allyRecommendationCount,
        },
      }
    : {
        code: "decision_session.sources.empty",
        severity: "info",
      };

  return {
    sourcesSummary,
    missingOptionsWarnings,
    duplicatedOptionsWarnings,
    unsupportedArgumentWarnings,
    riskVisibilityWarnings,
    feasibilityWarnings,
    clarityWarnings,
    consistencyWarnings: snapshot.consistencyChecks.filter((check) => check.status === "warning"),
  };
}
