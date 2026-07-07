import type {
  DecisionSession,
  ImplementationTrackingUpdate,
  Initiative,
  InitiativeCollaborativeAnalysis,
  InitiativeDecisionVote,
  InitiativeImplementationCommitment,
  InitiativeImplementationTracking,
  InitiativeImprovementProposal,
  InitiativePublicImpact,
} from "@hu/types";

export interface MyDecisionVoteRecord {
  vote: InitiativeDecisionVote;
  decisionQuestion: string;
  initiativeId: string;
}

export interface DeferredActivityGroup {
  kind: "deferred";
  id: string;
  title: string;
  reason: string;
}

export interface ActivityGroupMetrics {
  total: number;
  draft?: number;
  published?: number;
  submitted?: number;
  active?: number;
  completed?: number;
  verified?: number;
  votesCast?: number;
  latestActivityDate: string | null;
}

export interface ActiveActivityGroup {
  kind: "active";
  id: string;
  title: string;
  metrics: ActivityGroupMetrics;
  note?: string;
}

export type CivicActivityGroup = ActiveActivityGroup | DeferredActivityGroup;

export type CivicTimelineEventType =
  | "initiative_created"
  | "initiative_published"
  | "analysis_published"
  | "proposal_submitted"
  | "proposal_accepted"
  | "proposal_declined"
  | "vote_cast"
  | "vote_updated"
  | "decision_session_published"
  | "commitment_published"
  | "implementation_tracking_activated"
  | "implementation_update_added"
  | "implementation_tracking_completed"
  | "public_impact_published"
  | "public_impact_verified";

export interface CivicTimelineEntry {
  id: string;
  type: CivicTimelineEventType;
  label: string;
  detail: string;
  occurredAt: string;
  href?: string;
}

export interface CivicActivitySnapshot {
  groups: CivicActivityGroup[];
  timeline: CivicTimelineEntry[];
  loadedAt: string;
}

export interface CivicActivitySourceData {
  initiatives: Initiative[];
  analyses: InitiativeCollaborativeAnalysis[];
  proposals: InitiativeImprovementProposal[];
  decisionSessions: DecisionSession[];
  votes: MyDecisionVoteRecord[];
  commitments: InitiativeImplementationCommitment[];
  trackings: InitiativeImplementationTracking[];
  trackingUpdates: ImplementationTrackingUpdate[];
  impacts: InitiativePublicImpact[];
}
