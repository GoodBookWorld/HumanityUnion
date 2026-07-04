import type {
  AchievementId,
  EvidenceId,
  EvidenceKind,
  ImplementationCommitmentId,
  ImplementationId,
  ImplementationPhaseId,
  ImplementationStatus,
  MilestoneId,
  PhaseStatus,
} from "./implementation/index.js";
import type {
  PublicCollectiveDecisionReference,
  PublicInitiativeContext,
  PublicPetitionReference,
  PublicRegistrationGatewayGuidance,
} from "./public-implementation-commitment.js";

export interface PublicImplementationIdentity {
  implementationId: ImplementationId;
  title: string;
  summary: string;
  lifecycleStatus: ImplementationStatus;
  recordingStatusSummary: string;
}

export interface PublicImplementationCommitmentReference {
  implementationCommitmentId: ImplementationCommitmentId;
  summaryStatement: string;
  contextNote: string;
  contextAvailable: boolean;
}

export interface PublicImplementationStatusProjection {
  lifecycleStatus: ImplementationStatus;
  lifecycleStatusLabel: string;
  recordingStatusSummary: string;
  progressClaimsProvisional: boolean;
  derivedProgressHeadline: string;
  derivedCompletionHeadline: string;
}

export interface PublicCollectiveProgressProjection {
  aggregateProgressSummary: string;
  progressIndicatorHeadline: string;
  requiredMilestoneProgressLabel: string;
  completedPhaseCount: number;
  completedMilestoneCount: number;
  requiredMilestonesSatisfiedCount: number;
  requiredMilestonesTotalCount: number;
  optionalMilestonesSatisfiedCount: number;
  totalAchievements: number;
  derivedAt: string;
  derivedValueNote: string;
}

export interface PublicImplementationPhaseProjection {
  implementationPhaseId: ImplementationPhaseId;
  title: string;
  summary: string;
  status: PhaseStatus;
  sequenceOrder: number;
}

export interface PublicCurrentPhaseProjection {
  currentPhase: PublicImplementationPhaseProjection | null;
  completedPhases: PublicImplementationPhaseProjection[];
  upcomingPhases: PublicImplementationPhaseProjection[];
}

export interface PublicAchievementProjection {
  achievementId: AchievementId;
  title: string;
  summary: string;
  milestoneId: MilestoneId;
  milestoneTitle: string;
  phaseTitle: string | null;
  recordedAt: string;
  evidenceAvailable: boolean;
}

export interface PublicEvidenceProjection {
  evidenceId: EvidenceId;
  label: string;
  evidenceKind: EvidenceKind;
  achievementId: AchievementId;
  achievementTitle: string;
  recordedAt: string;
  referenceDisplayLabel: string | null;
  linkDisplayLabel: string | null;
  attachmentDisplayLabel: string | null;
}

export interface PublicCompletionProjection {
  completionReached: boolean;
  assessmentReached: boolean;
  completionHeadline: string;
  requiredCriteriaProgressLabel: string;
  explanation: string;
  assessmentExplanation: string;
  remainingRequiredMilestoneDescriptions: string[];
  satisfiedRequiredMilestoneCount: number;
  totalRequiredMilestoneCount: number;
  notReapprovalStatement: string;
  derivedAt: string;
  derivedValueNote: string;
}

export interface PublicImplementationShareReference {
  url: string | null;
  available: boolean;
  sharingNote: string;
}

export interface PublicImplementationHumanityAssistantPanel {
  summary: string;
  progressExplanation: string;
  achievementExplanation: string;
  evidenceExplanation: string;
  completionExplanation: string;
  boundaryStatement: string;
}

/** Public read model for Stage 7 — Implementation. */
export interface PublicImplementationProjection {
  implementationIdentity: PublicImplementationIdentity;
  initiativeContext: PublicInitiativeContext;
  collectiveDecisionReference: PublicCollectiveDecisionReference;
  petitionReference: PublicPetitionReference;
  implementationCommitmentReference: PublicImplementationCommitmentReference;
  implementationStatus: PublicImplementationStatusProjection;
  collectiveProgress: PublicCollectiveProgressProjection;
  currentPhase: PublicCurrentPhaseProjection;
  achievements: PublicAchievementProjection[];
  evidence: PublicEvidenceProjection[];
  completion: PublicCompletionProjection;
  shareReference: PublicImplementationShareReference;
  registrationGateway: PublicRegistrationGatewayGuidance;
  humanityAssistant: PublicImplementationHumanityAssistantPanel;
}
