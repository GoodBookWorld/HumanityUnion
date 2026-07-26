import { randomUUID } from "node:crypto";

import {
  ACTIVITY_AGGREGATE_VERSION_INITIAL,
  ACTIVITY_STATUSES,
  type ActivityRecord,
  type CreateActivityCommandInput,
} from "./activity.types.js";

export function buildActivityAggregateForCreate(input: {
  command: CreateActivityCommandInput;
  creatorMemberId: string;
  occurredAt?: string;
}): ActivityRecord {
  const timestamp = input.occurredAt ?? new Date().toISOString();

  return {
    activityId: randomUUID(),
    creatorMemberId: input.creatorMemberId,
    title: input.command.title,
    description: input.command.description,
    activityType: input.command.activityType,
    visibility: input.command.visibility,
    status: ACTIVITY_STATUSES[0],
    aggregateVersion: ACTIVITY_AGGREGATE_VERSION_INITIAL,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
