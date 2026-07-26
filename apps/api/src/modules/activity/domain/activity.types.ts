export const ACTIVITY_AGGREGATE_TYPE = "Activity" as const;
export const ACTIVITY_AGGREGATE_VERSION_INITIAL = 1 as const;

export const ACTIVITY_VISIBILITY_LEVELS = [
  "public",
  "allies",
  "working_group",
  "private",
] as const;

export type ActivityVisibility = (typeof ACTIVITY_VISIBILITY_LEVELS)[number];

/** MVP civic trace anchor type for member-initiated Activities. */
export const ACTIVITY_TYPES = ["civic_participation"] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_STATUSES = ["open"] as const;

export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

export interface ActivityRecord {
  activityId: string;
  creatorMemberId: string;
  title: string;
  description: string;
  activityType: ActivityType;
  visibility: ActivityVisibility;
  status: ActivityStatus;
  aggregateVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityDetailDto {
  activityId: string;
  creatorMemberId: string;
  title: string;
  description: string;
  activityType: ActivityType;
  visibility: ActivityVisibility;
  status: ActivityStatus;
  aggregateVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateActivityCommandInput {
  title: string;
  description: string;
  activityType: ActivityType;
  visibility: ActivityVisibility;
}

export interface CreateActivityResult {
  activity: ActivityDetailDto;
}
