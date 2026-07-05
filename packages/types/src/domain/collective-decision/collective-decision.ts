import type { Ballot } from "./ballot.js";
import type { DecisionResult } from "./decision-result.js";
import type { DecisionStatistics } from "./decision-statistics.js";
import type { DecisionTimeline } from "./decision-timeline.js";
import type { Outcome } from "./outcome.js";
import type { ParticipantDecision } from "./participant-decision.js";

export type DecisionId = string;

export type DecisionSubjectType =
  "Initiative" | "Candidate" | "Policy" | "Project" | "Organization" | "Institution" | "Program";

export type DecisionMechanism =
  | "CommunityPoll"
  | "CandidateSelection"
  | "OptionSelection"
  | "PrioritySelection"
  | "TrustEvaluation"
  | "GovernanceDecision";

export type CollectiveDecisionStatus =
  "Draft" | "Scheduled" | "Active" | "Closed" | "Completed" | "Archived" | "Cancelled";

export interface CollectiveDecision {
  decisionId: DecisionId;
  decisionSubjectType: DecisionSubjectType;
  decisionSubjectId: string;
  decisionMechanism: DecisionMechanism;
  status: CollectiveDecisionStatus;
  createdAt: string;
  updatedAt: string;
  ballot: Ballot;
  participantDecisions: ParticipantDecision[];
  decisionResult: DecisionResult | null;
  outcome: Outcome | null;
  statistics: DecisionStatistics;
  timeline: DecisionTimeline;
}
