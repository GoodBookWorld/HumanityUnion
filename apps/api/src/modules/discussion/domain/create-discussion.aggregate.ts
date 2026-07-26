import { randomUUID } from "node:crypto";

import type { ActivityRecord } from "../../activity/domain/activity.types.js";
import {
  DISCUSSION_AGGREGATE_VERSION_INITIAL,
  DISCUSSION_STATUSES,
  type CreateDiscussionCommandInput,
  type DiscussionRecord,
} from "./discussion.types.js";

export function buildDiscussionAggregateForCreate(input: {
  command: CreateDiscussionCommandInput;
  creatorMemberId: string;
  activity: ActivityRecord;
  occurredAt?: string;
}): DiscussionRecord {
  const timestamp = input.occurredAt ?? new Date().toISOString();

  return {
    discussionId: randomUUID(),
    activityId: input.command.activityId,
    creatorMemberId: input.creatorMemberId,
    title: input.command.title,
    openingMessage: input.command.openingMessage,
    status: DISCUSSION_STATUSES[0],
    visibility: input.activity.visibility,
    aggregateVersion: DISCUSSION_AGGREGATE_VERSION_INITIAL,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
