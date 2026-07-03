import type { DecisionId } from "./collective-decision/index.js";
import type { InitiativeId } from "./initiative.js";
import type { PetitionId, PetitionOutcomeType, PetitionState } from "./petition/index.js";

export interface PublicPetitionIdentity {
  petitionId: PetitionId;
  title: string;
  supportStatus: string;
  lifecycleStatus: PetitionState;
}

export interface PublicPetitionSummary {
  purpose: string;
  followsApprovedDecisionStatement: string;
  publishedAt: string | null;
  opensAt: string | null;
  closesAt: string | null;
}

export interface PublicPetitionSubject {
  subjectType: "Initiative";
  initiativeId: InitiativeId;
  title: string;
  summary: string;
}

export interface PublicApprovedDecisionContext {
  collectiveDecisionId: DecisionId;
  decisionSummary: string | null;
  approvedOutcomeSummary: string | null;
  approvedResultSummary: string | null;
  initiativeContextSummary: string | null;
  analysisContextSummary: string | null;
  contextAvailable: boolean;
}

export type PublicSupportState = "pending" | "active" | "final";

export interface PublicSupportStatistics {
  supportCount: number;
  supportState: PublicSupportState;
  thresholdDefined: boolean;
  thresholdReached: boolean;
  thresholdProgress: string | null;
  recentActivitySummary: string | null;
}

export interface PublicPetitionOutcomeProjection {
  outcomeType: PetitionOutcomeType;
  explanation: string;
  finalSupportCount: number | null;
}

export interface PublicShareReference {
  url: string | null;
  available: boolean;
  sharingNote: string;
}

export interface PublicParticipationEntryGuidance {
  registrationRequired: boolean;
  signingAvailable: boolean;
  observationAvailable: boolean;
  entryIntent: string;
  registrationGatewayMessage: string;
  viewingNote: string;
  sharingNote: string;
  workspacePath: string;
}

export interface PublicPetitionProjection {
  petitionIdentity: PublicPetitionIdentity;
  petitionSummary: PublicPetitionSummary;
  petitionSubject: PublicPetitionSubject;
  approvedDecisionContext: PublicApprovedDecisionContext;
  publicSupportStatistics: PublicSupportStatistics;
  petitionOutcome: PublicPetitionOutcomeProjection | null;
  shareReference: PublicShareReference;
  participationEntryGuidance: PublicParticipationEntryGuidance;
}
