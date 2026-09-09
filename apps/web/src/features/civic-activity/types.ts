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

/** Stable activity-summary group identity (not a display label). */
export type CivicActivityGroupId =
  | "initiatives"
  | "analyses"
  | "proposals"
  | "decision-participation"
  | "implementation-commitments"
  | "implementation-tracking"
  | "public-impact";

/** Stable WEB_UI note key for optional group footnotes. */
export type CivicActivityGroupNoteKey =
  | "decisionVotesLinked"
  | "decisionVotesLinkedPendingApi";

export interface DeferredActivityGroup {
  kind: "deferred";
  id: CivicActivityGroupId | string;
  reasonKey: string;
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
  /** Initiative Lifecycle — Part I: proposed Implementation Commitments awaiting my Accept/Decline. */
  proposed?: number;
  latestActivityDate: string | null;
}

export interface ActiveActivityGroup {
  kind: "active";
  id: CivicActivityGroupId | string;
  metrics: ActivityGroupMetrics;
  noteKey?: CivicActivityGroupNoteKey;
}

export type CivicActivityGroup = ActiveActivityGroup | DeferredActivityGroup;

export type CivicTimelineEventType =
  | "initiative_created"
  | "initiative_published"
  | "analysis_published"
  | "proposal_submitted"
  | "proposal_accepted"
  | "proposal_partially_accepted"
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
  /** Canonical/API entity prose — not WEB_UI chrome. */
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
