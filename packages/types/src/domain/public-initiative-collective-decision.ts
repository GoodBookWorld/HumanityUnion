import type {
  InitiativeCollectiveDecisionId,
  InitiativeCollectiveDecisionStatistics,
  InitiativeCollectiveDecisionStatus,
  ParticipationScope,
} from "./initiative-collective-decision.js";
import type {
  CollectiveDecisionPublicOutcome,
  ParticipationConfidenceLevel,
} from "./collective-decision-transparent-results.js";
import type { DecisionSessionId } from "./decision-session.js";
import type { InitiativeId } from "./initiative.js";

export interface PublicInitiativeCollectiveDecisionProjection {
  decisionId: InitiativeCollectiveDecisionId;
  initiativeId: InitiativeId;
  decisionSessionId: DecisionSessionId;
  sequenceNumber: number;
  participationScope: ParticipationScope;
  status: Exclude<InitiativeCollectiveDecisionStatus, "draft">;
  question: string;
  openedAt?: string;
  closesAt: string;
  closedAt?: string;
  cancelledAt?: string;
  supersedesDecisionId?: InitiativeCollectiveDecisionId;
  stewardDisplayName: string;
  statistics: InitiativeCollectiveDecisionStatistics;
  outcome: CollectiveDecisionPublicOutcome | null;
  participationConfidenceLevel: ParticipationConfidenceLevel;
  outcomeSummary: string;
  transparencyNote: string;
}

export interface PublicInitiativeCollectiveDecisionListItem {
  decisionId: InitiativeCollectiveDecisionId;
  sequenceNumber: number;
  status: Exclude<InitiativeCollectiveDecisionStatus, "draft">;
  question: string;
  participationScope: ParticipationScope;
  openedAt?: string;
  closesAt: string;
  closedAt?: string;
  statistics: InitiativeCollectiveDecisionStatistics;
  outcome: CollectiveDecisionPublicOutcome | null;
  participationConfidenceLevel: ParticipationConfidenceLevel;
  outcomeSummary: string;
  transparencyNote: string;
}

export interface InitiativeCollectiveDecisionMetrics {
  decisionCount: number;
  openedCount: number;
  closedCount: number;
  cancelledCount: number;
}
