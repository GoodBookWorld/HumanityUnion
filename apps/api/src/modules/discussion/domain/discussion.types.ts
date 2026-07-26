import type { ActivityVisibility } from "../../activity/domain/activity.types.js";

export const DISCUSSION_AGGREGATE_TYPE = "Discussion" as const;
export const DISCUSSION_AGGREGATE_VERSION_INITIAL = 1 as const;

export const DISCUSSION_STATUSES = ["open"] as const;

export type DiscussionStatus = (typeof DISCUSSION_STATUSES)[number];

export interface DiscussionRecord {
  discussionId: string;
  activityId: string;
  creatorMemberId: string;
  title: string;
  openingMessage: string;
  status: DiscussionStatus;
  visibility: ActivityVisibility;
  aggregateVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface DiscussionDetailDto {
  discussionId: string;
  activityId: string;
  creatorMemberId: string;
  title: string;
  openingMessage: string;
  status: DiscussionStatus;
  visibility: ActivityVisibility;
  aggregateVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDiscussionCommandInput {
  activityId: string;
  title: string;
  openingMessage: string;
}

export interface CreateDiscussionResult {
  discussion: DiscussionDetailDto;
}
