import type { CommitmentState } from "./implementation-commitment/commitment-state.js";
import type { DecisionId } from "./collective-decision/index.js";
import type { ImplementationCommitmentId } from "./implementation-commitment/identifiers.js";
import type { InitiativeId } from "./initiative.js";
import type { PetitionId } from "./petition/index.js";

export interface PublicImplementationCommitmentIdentity {
  implementationCommitmentId: ImplementationCommitmentId;
  title: string;
  lifecycleStatus: CommitmentState;
  collectionStatusSummary: string;
}

export interface PublicInitiativeContext {
  initiativeId: InitiativeId;
  title: string;
  summary: string;
}

export interface PublicCollectiveDecisionReference {
  collectiveDecisionId: DecisionId;
  decisionSummary: string | null;
  approvedOutcomeSummary: string | null;
  approvedResultSummary: string | null;
  contextAvailable: boolean;
}

export interface PublicPetitionReference {
  petitionId: PetitionId;
  summaryStatement: string;
  endorsementContextNote: string;
  contextAvailable: boolean;
}

export interface PublicCommunityCapacityProjection {
  totalContributions: number;
  volunteers: number;
  professionalCapacity: number;
  resources: number;
  availabilitySummary: string;
  skillCoverageSummary: string;
  derivedAt: string;
  derivedValueNote: string;
}

export interface PublicFrozenPolicySummary {
  frozenPolicyId: string;
  label: string;
  summaryStatement: string;
  requiredThresholdLabels: string[];
  optionalThresholdLabels: string[];
}

export interface PublicImplementationReadinessProjection {
  readinessReached: boolean;
  explanation: string;
  satisfiedThresholdCount: number;
  unsatisfiedThresholdCount: number;
  notApprovalStatement: string;
  derivedAt: string;
  derivedValueNote: string;
}

export interface PublicCommunityNeedProjection {
  description: string;
}

export interface PublicImplementationCommitmentShareReference {
  url: string | null;
  available: boolean;
  sharingNote: string;
}

export interface PublicRegistrationGatewayGuidance {
  registrationRequired: boolean;
  declarationAvailable: boolean;
  observationAvailable: boolean;
  entryIntent: string;
  registrationGatewayMessage: string;
  viewingNote: string;
  sharingNote: string;
  workspacePath: string;
}

export interface PublicHumanityAssistantPanel {
  summary: string;
  readinessExplanation: string;
  policyExplanation: string;
  communityNeedsExplanation: string;
  boundaryStatement: string;
}

export interface PublicImplementationCommitmentProjection {
  commitmentIdentity: PublicImplementationCommitmentIdentity;
  initiativeContext: PublicInitiativeContext;
  collectiveDecisionReference: PublicCollectiveDecisionReference;
  petitionReference: PublicPetitionReference;
  communityCapacity: PublicCommunityCapacityProjection;
  frozenPolicySummary: PublicFrozenPolicySummary;
  implementationReadiness: PublicImplementationReadinessProjection;
  communityNeeds: PublicCommunityNeedProjection[];
  shareReference: PublicImplementationCommitmentShareReference;
  registrationGateway: PublicRegistrationGatewayGuidance;
  humanityAssistant: PublicHumanityAssistantPanel;
}
