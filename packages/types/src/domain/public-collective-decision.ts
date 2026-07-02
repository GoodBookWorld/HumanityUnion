import type {
  CollectiveDecisionStatus,
  DecisionId,
  DecisionMechanism,
  DecisionStatistics,
  DecisionSubjectType,
  OutcomeType,
} from "./collective-decision/index.js";

export interface PublicDecisionSubject {
  subjectType: DecisionSubjectType;
  subjectId: string;
  title: string;
}

export interface PublicDecisionOptionResult {
  label: string;
  count: number;
  percentage: number;
}

export interface PublicDecisionResult {
  calculatedAt: string;
  optionResults: PublicDecisionOptionResult[];
  winningOptionLabel: string | null;
  participationRate: number;
  quorumSatisfied: boolean;
  thresholdSatisfied: boolean;
}

export interface PublicDecisionOutcome {
  outcomeType: OutcomeType;
  nextLifecycleStage: string;
  explanation: string;
}

export interface PublicCollectiveDecisionProjection {
  decisionId: DecisionId;
  decisionSubject: PublicDecisionSubject;
  decisionTemplate: DecisionMechanism;
  status: CollectiveDecisionStatus;
  decisionSummary: string;
  decisionResult: PublicDecisionResult | null;
  outcome: PublicDecisionOutcome | null;
  participationStatistics: DecisionStatistics;
  completedAt: string | null;
}
