import type { CivicEntityType, CivicPipelineStageId } from "@hu/types";

export type WorkspaceSuggestionPriority = "critical" | "important" | "normal" | "informational";

export interface WorkspaceSuggestionRelatedEntity {
  entityType: CivicEntityType | "participation_area" | "member_profile" | "workspace";
  entityId?: string;
  title?: string;
}

export interface WorkspaceSuggestion {
  suggestionId: string;
  title: string;
  description: string;
  reason: string;
  relatedEntity: WorkspaceSuggestionRelatedEntity;
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

export interface WorkspaceIntelligenceParticipationArea {
  country?: string;
  region?: string;
  community?: string;
  verificationStatus: string;
  hasPendingTransition: boolean;
  pendingEffectiveAt?: string;
}

export interface WorkspaceIntelligenceInitiativeState {
  initiativeId: string;
  title: string;
  lifecyclePhase: string;
  isSteward: boolean;
  pipelineCurrentStageId: CivicPipelineStageId | null;
  pipelineNextStageId: CivicPipelineStageId | null;
  hasPublishedAnalysis: boolean;
  hasSubmittedProposal: boolean;
  hasAcceptedProposal: boolean;
  hasPublishedRevision: boolean;
  hasOpenDecisionSession: boolean;
  hasClosedDecisionSession: boolean;
  hasOpenCollectiveDecision: boolean;
  hasClosedCollectiveDecision: boolean;
  hasCivicActionPackage: boolean;
  hasDelivery: boolean;
  hasOfficialResponse: boolean;
  hasActiveAccountability: boolean;
  hasPublishedCommitment: boolean;
  hasActiveTracking: boolean;
  hasCompletedTracking: boolean;
  hasPublishedImpact: boolean;
  hasVerifiedImpact: boolean;
  hasArchiveDraft: boolean;
  hasPublishedArchive: boolean;
  openDecisionId?: string;
  openDecisionQuestion?: string;
  participantEligibleToVote: boolean;
  participantHasVote: boolean;
}

export interface WorkspaceIntelligenceContext {
  participantDisplayName: string;
  participationArea: WorkspaceIntelligenceParticipationArea;
  currentSection: string;
  currentCivicStage: string | null;
  nextCivicMilestone: string | null;
  openResponsibilities: string[];
  unreadNotificationCount: number;
  initiative: WorkspaceIntelligenceInitiativeState | null;
  integrationViewLoaded: boolean;
  evaluatedAt: string;
}

export interface WorkspaceIntelligenceResponse {
  context: WorkspaceIntelligenceContext;
  currentCivicStage: string | null;
  currentResponsibilities: string[];
  suggestions: WorkspaceSuggestion[];
  blockedActions: WorkspaceBlockedAction[];
  nextCivicMilestone: string | null;
  topRecommendation: WorkspaceSuggestion | null;
  constitutionalSummary: string;
}

export interface WorkspaceIntelligenceRuleInput {
  context: WorkspaceIntelligenceContext;
}

export interface WorkspaceIntelligenceRuleDefinition {
  id: string;
  description: string;
  stage: CivicPipelineStageId | "workspace";
  priority: WorkspaceSuggestionPriority;
  evaluate: (input: WorkspaceIntelligenceRuleInput) => WorkspaceSuggestion[];
}

export interface WorkspaceIntelligenceBlockedRuleDefinition {
  id: string;
  description: string;
  evaluate: (input: WorkspaceIntelligenceRuleInput) => WorkspaceBlockedAction[];
}

export const WORKSPACE_SUGGESTION_PRIORITY_ORDER: readonly WorkspaceSuggestionPriority[] = [
  "critical",
  "important",
  "normal",
  "informational",
];
