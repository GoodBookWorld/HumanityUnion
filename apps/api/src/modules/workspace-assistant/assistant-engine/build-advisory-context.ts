import type { WorkspaceAssistantAdvisoryContext } from "@hu/types";

import type { WorkspaceIntelligenceResponse } from "../../workspace-intelligence/workspace-intelligence.types.js";

export function buildWorkspaceAssistantAdvisoryContext(
  intelligence: WorkspaceIntelligenceResponse,
  initiativeDescription?: string,
): WorkspaceAssistantAdvisoryContext {
  const topRecommendation = intelligence.topRecommendation;

  return {
    constitutionalSummary: intelligence.constitutionalSummary,
    currentCivicStage: intelligence.currentCivicStage,
    nextCivicMilestone: intelligence.nextCivicMilestone,
    responsibilities: intelligence.currentResponsibilities,
    topRecommendation: topRecommendation
      ? {
          title: topRecommendation.title,
          description: topRecommendation.description,
          reason: topRecommendation.reason,
          recommendedAction: topRecommendation.recommendedAction,
        }
      : null,
    secondaryRecommendations: intelligence.suggestions.slice(1, 4).map((suggestion) => ({
      title: suggestion.title,
      description: suggestion.description,
      recommendedAction: suggestion.recommendedAction,
    })),
    blockedActions: intelligence.blockedActions.slice(0, 5).map((blocked) => ({
      title: blocked.title,
      reason: blocked.reason,
    })),
    initiativeDescription,
  };
}
