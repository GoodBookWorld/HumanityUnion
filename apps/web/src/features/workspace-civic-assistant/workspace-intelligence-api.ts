import { apiRequest } from "../../lib/api-client";

export type WorkspaceSuggestionPriority = "critical" | "important" | "normal" | "informational";

export interface WorkspaceSuggestion {
  suggestionId: string;
  title: string;
  description: string;
  reason: string;
  relatedEntity: {
    entityType: string;
    entityId?: string;
    title?: string;
  };
  relatedRoute: string;
  priority: WorkspaceSuggestionPriority;
  recommendedAction: string;
  blockedBy?: string;
  constitutionalReference: string;
}

export interface WorkspaceBlockedAction {
  actionId: string;
  title: string;
  reason: string;
  blockedBy: string;
  constitutionalReference: string;
  relatedRoute?: string;
}

export interface WorkspaceIntelligenceResponse {
  context: {
    participantDisplayName: string;
    participationArea: {
      country?: string;
      region?: string;
      community?: string;
      verificationStatus: string;
      hasPendingTransition: boolean;
      pendingEffectiveAt?: string;
    };
    currentSection: string;
    currentCivicStage: string | null;
    nextCivicMilestone: string | null;
    openResponsibilities: string[];
    unreadNotificationCount: number;
    initiative: {
      initiativeId: string;
      title: string;
      lifecyclePhase: string;
      isSteward: boolean;
    } | null;
    integrationViewLoaded: boolean;
    evaluatedAt: string;
  };
  currentCivicStage: string | null;
  currentResponsibilities: string[];
  suggestions: WorkspaceSuggestion[];
  blockedActions: WorkspaceBlockedAction[];
  nextCivicMilestone: string | null;
  topRecommendation: WorkspaceSuggestion | null;
  constitutionalSummary: string;
}

export interface FetchWorkspaceIntelligenceInput {
  initiativeId?: string;
  section?: string;
}

export async function fetchWorkspaceIntelligence(
  input: FetchWorkspaceIntelligenceInput = {},
): Promise<WorkspaceIntelligenceResponse> {
  const params = new URLSearchParams();

  if (input.initiativeId) {
    params.set("initiativeId", input.initiativeId);
  }

  if (input.section) {
    params.set("section", input.section);
  }

  const query = params.toString();
  const path = query
    ? `/api/v1/workspace-assistant/intelligence?${query}`
    : "/api/v1/workspace-assistant/intelligence";

  return apiRequest<WorkspaceIntelligenceResponse>(path);
}
