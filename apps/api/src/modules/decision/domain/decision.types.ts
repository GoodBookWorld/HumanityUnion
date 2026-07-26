import type { ActivityVisibility } from "../../activity/domain/activity.types.js";

export const DECISION_AGGREGATE_TYPE = "Decision" as const;
export const DECISION_AGGREGATE_VERSION_INITIAL = 1 as const;

export const DECISION_STATUSES = ["open"] as const;

export type DecisionStatus = (typeof DECISION_STATUSES)[number];

export interface DecisionRecord {
  decisionId: string;
  proposalId: string;
  activityId: string;
  creatorMemberId: string;
  title: string;
  status: DecisionStatus;
  visibility: ActivityVisibility;
  aggregateVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface DecisionDetailDto {
  decisionId: string;
  proposalId: string;
  activityId: string;
  creatorMemberId: string;
  title: string;
  status: DecisionStatus;
  visibility: ActivityVisibility;
  aggregateVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDecisionCommandInput {
  proposalId: string;
}

export interface CreateDecisionResult {
  decision: DecisionDetailDto;
}
