import type {
  InitiativeDecisionSessionDraft,
  InitiativeDecisionSessionIntelligenceSnapshot,
} from "@hu/types";

export interface DecisionSessionAiAssistantInsights {
  sourcesUsedSummary: string;
  missingOptionsWarnings: string[];
  duplicatedOptionsWarnings: string[];
  unsupportedArgumentWarnings: string[];
  riskVisibilityWarnings: string[];
  feasibilityWarnings: string[];
  clarityWarnings: string[];
}

export function deriveDecisionSessionAiAssistantInsights(
  snapshot: InitiativeDecisionSessionIntelligenceSnapshot,
  draft: InitiativeDecisionSessionDraft | null,
): DecisionSessionAiAssistantInsights {
  const missingOptionsWarnings: string[] = [];
  const duplicatedOptionsWarnings: string[] = [];
  const unsupportedArgumentWarnings: string[] = [];
  const riskVisibilityWarnings: string[] = [];
  const feasibilityWarnings: string[] = [];
  const clarityWarnings: string[] = [];

  if (!snapshot.petitionReference) {
    missingOptionsWarnings.push("Publish a Petition before generating Decision options.");
  }

  if (draft) {
    if (draft.options.length < 2) {
      missingOptionsWarnings.push("Add at least two Decision Options so the Collective Decision has a real choice.");
    }

    const normalized = draft.options.map((option) => option.trim().toLowerCase());
    const duplicates = normalized.filter((option, index) => option && normalized.indexOf(option) !== index);
    if (duplicates.length > 0) {
      duplicatedOptionsWarnings.push("Some Decision Options appear duplicated — consolidate before publishing.");
    }

    if (draft.supportingArguments.length === 0) {
      unsupportedArgumentWarnings.push("No Supporting Arguments yet — cite Petition signatures, Analysis, or Proposals.");
    }

    if (draft.risks.length === 0) {
      riskVisibilityWarnings.push("No Risks listed — surface implementation and participation risks before publish.");
    }

    if (!draft.suggestedTimeline.trim()) {
      feasibilityWarnings.push("Suggested Timeline is empty — Collective Decision timing will be unclear.");
    }

    if (draft.suggestedResponsibleRoles.length === 0) {
      feasibilityWarnings.push("No Suggested Responsible Roles — identify who facilitates and implements.");
    }

    if (!draft.decisionQuestion.trim() || draft.decisionQuestion.length < 20) {
      clarityWarnings.push("Decision Question should be a clear, neutral yes/no or multi-option civic question.");
    }
  }

  for (const check of snapshot.consistencyChecks) {
    if (check.status === "warning") {
      clarityWarnings.push(check.detail);
    }
  }

  const sourcesUsedSummary = [
    snapshot.petitionReference ? "Published Petition" : null,
    snapshot.revisionReference ? `Revision v${snapshot.revisionReference.version}` : null,
    snapshot.analysisReference ? "Collaborative Analysis" : null,
    snapshot.proposalReferences.length > 0
      ? `${snapshot.proposalReferences.length} Proposal(s)`
      : null,
    snapshot.allyRecommendations.length > 0
      ? `${snapshot.allyRecommendations.length} Ally recommendation(s)`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    sourcesUsedSummary: sourcesUsedSummary || "No Decision Sources available yet.",
    missingOptionsWarnings,
    duplicatedOptionsWarnings,
    unsupportedArgumentWarnings,
    riskVisibilityWarnings,
    feasibilityWarnings,
    clarityWarnings,
  };
}
