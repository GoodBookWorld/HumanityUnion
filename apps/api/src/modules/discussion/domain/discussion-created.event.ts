import { randomUUID } from "node:crypto";

import { CATALOGUE_EVENTS } from "../../../infrastructure/events/catalogue-events.js";
import { createDomainEvent } from "../../../infrastructure/events/event-envelope.js";
import type { DomainEvent } from "../../../infrastructure/events/domain-event.js";
import {
  DISCUSSION_AGGREGATE_TYPE,
  type DiscussionRecord,
} from "./discussion.types.js";

export interface DiscussionCreatedPayload extends Record<string, unknown> {
  discussionId: string;
  activityId: string;
  creatorMemberId: string;
  title: string;
  status: DiscussionRecord["status"];
  visibility: DiscussionRecord["visibility"];
  createdAt: string;
}

export function buildDiscussionCreatedEventId(discussionId: string): string {
  return `discussion-created:${discussionId}`;
}

export function createDiscussionCreatedEvent(input: {
  discussion: DiscussionRecord;
  correlationId?: string;
  actorId?: string | null;
}): DomainEvent<DiscussionCreatedPayload> {
  return createDomainEvent({
    eventId: buildDiscussionCreatedEventId(input.discussion.discussionId),
    eventName: CATALOGUE_EVENTS.discussionCreated,
    aggregateType: DISCUSSION_AGGREGATE_TYPE,
    aggregateId: input.discussion.discussionId,
    payload: {
      discussionId: input.discussion.discussionId,
      activityId: input.discussion.activityId,
      creatorMemberId: input.discussion.creatorMemberId,
      title: input.discussion.title,
      status: input.discussion.status,
      visibility: input.discussion.visibility,
      createdAt: input.discussion.createdAt,
    },
    correlationId: input.correlationId ?? randomUUID(),
    actorId: input.actorId ?? input.discussion.creatorMemberId,
    occurredAt: input.discussion.createdAt,
  });
}
