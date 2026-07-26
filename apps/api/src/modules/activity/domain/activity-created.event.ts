import { randomUUID } from "node:crypto";

import { CATALOGUE_EVENTS } from "../../../infrastructure/events/catalogue-events.js";
import { createDomainEvent } from "../../../infrastructure/events/event-envelope.js";
import type { DomainEvent } from "../../../infrastructure/events/domain-event.js";
import {
  ACTIVITY_AGGREGATE_TYPE,
  type ActivityRecord,
} from "./activity.types.js";

export interface ActivityCreatedPayload extends Record<string, unknown> {
  activityId: string;
  creatorMemberId: string;
  title: string;
  activityType: ActivityRecord["activityType"];
  visibility: ActivityRecord["visibility"];
  status: ActivityRecord["status"];
  createdAt: string;
}

export function buildActivityCreatedEventId(activityId: string): string {
  return `activity-created:${activityId}`;
}

export function createActivityCreatedEvent(input: {
  activity: ActivityRecord;
  correlationId?: string;
  actorId?: string | null;
}): DomainEvent<ActivityCreatedPayload> {
  return createDomainEvent({
    eventId: buildActivityCreatedEventId(input.activity.activityId),
    eventName: CATALOGUE_EVENTS.activityCreated,
    aggregateType: ACTIVITY_AGGREGATE_TYPE,
    aggregateId: input.activity.activityId,
    payload: {
      activityId: input.activity.activityId,
      creatorMemberId: input.activity.creatorMemberId,
      title: input.activity.title,
      activityType: input.activity.activityType,
      visibility: input.activity.visibility,
      status: input.activity.status,
      createdAt: input.activity.createdAt,
    },
    correlationId: input.correlationId ?? randomUUID(),
    actorId: input.actorId ?? input.activity.creatorMemberId,
    occurredAt: input.activity.createdAt,
  });
}
