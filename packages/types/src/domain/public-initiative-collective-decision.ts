import type {
  InitiativeCollectiveDecisionId,
  InitiativeCollectiveDecisionStatistics,
  InitiativeCollectiveDecisionStatus,
  ParticipationScope,
} from "./initiative-collective-decision.js";
import type {
  CollectiveDecisionStructuredContent,
  CollectiveDecisionTraceability,
} from "./initiative-collective-decision-lifecycle.js";
import type {
  CollectiveDecisionPublicOutcome,
  ParticipationConfidenceLevel,
} from "./collective-decision-transparent-results.js";
import type { DecisionSessionId } from "./decision-session.js";
import type { InitiativeId } from "./initiative.js";
import type { InitiativeDecisionBallotAggregates } from "./initiative-decision-vote.js";
import type { PublicChoiceBallotMode } from "./public-choice-ballot-mode.js";

export interface PublicInitiativeCollectiveDecisionProjection {
  decisionId: InitiativeCollectiveDecisionId;
  initiativeId: InitiativeId;
  decisionSessionId: DecisionSessionId | null;
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
  /** Initiative Lifecycle — Part H, Section 6/8. Structured Decision Result. */
  structuredContent: CollectiveDecisionStructuredContent | null;
  /** Initiative Lifecycle — Part H, Section 9. Decision Session provenance. */
  traceability: CollectiveDecisionTraceability | null;
  /**
   * Public Choice Architecture Pack 02A — present on PUBLIC_CHOICE decisions.
   * STANDARD projections omit these fields.
   */
  ballotMode?: PublicChoiceBallotMode;
  ballotAggregates?: InitiativeDecisionBallotAggregates;
  /**
   * Pack 02C — temporary results retention presentation.
   * Download availability is policy-based (closedAt + 72h), not physical TTL state.
   */
  resultsRetention?: {
    status: "voting_open" | "results_available" | "results_expired" | "no_results";
    downloadAvailable: boolean;
    votingCloseAt?: string;
    expiresAt?: string;
    resultsExpiredAt?: string;
  };
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
  /** Pack 02A — PUBLIC_CHOICE only. */
  ballotMode?: PublicChoiceBallotMode;
  ballotAggregates?: InitiativeDecisionBallotAggregates;
  /**
   * Pack 02C — temporary results retention presentation.
   * Download availability is policy-based (closedAt + 72h), not physical TTL state.
   */
  resultsRetention?: {
    status: "voting_open" | "results_available" | "results_expired" | "no_results";
    downloadAvailable: boolean;
    votingCloseAt?: string;
    expiresAt?: string;
    resultsExpiredAt?: string;
  };
}

export interface InitiativeCollectiveDecisionMetrics {
  decisionCount: number;
  openedCount: number;
  closedCount: number;
  cancelledCount: number;
}
