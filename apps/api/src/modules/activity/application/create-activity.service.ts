import { enqueueDomainEvent } from "../../../infrastructure/outbox/outbox.repository.js";
import { runMongoTransaction } from "../../../infrastructure/mongodb/mongo-transaction.js";
import { getCorrelationContext } from "../../../shared/observability/correlation.js";
import { logger } from "../../../shared/observability/logger.js";
import { getMemberById } from "../../member/member-access.js";
import { createActivityCreatedEvent } from "../domain/activity-created.event.js";
import {
  ActivityMemberNotRegisteredError,
  ActivityTransactionError,
} from "../domain/activity.errors.js";
import { buildActivityAggregateForCreate } from "../domain/create-activity.aggregate.js";
import type { CreateActivityCommandInput, CreateActivityResult } from "../domain/activity.types.js";
import { insertActivity } from "../infrastructure/activity.repository.js";
import { toActivityDetailDto } from "../infrastructure/activity.persistence.js";

export async function createActivity(input: {
  creatorMemberId: string;
  actorId: string;
  command: CreateActivityCommandInput;
  correlationId?: string;
}): Promise<CreateActivityResult> {
  const startedAt = Date.now();
  const correlationId =
    input.correlationId ?? getCorrelationContext()?.correlationId ?? input.actorId;

  logger.info("activity.creation.started", {
    component: "activity-create",
    correlationId,
    memberId: input.creatorMemberId,
  });

  const member = await getMemberById(input.creatorMemberId);

  if (!member) {
    logger.warn("activity.creation.failed", {
      component: "activity-create",
      correlationId,
      memberId: input.creatorMemberId,
      errorCode: "ACTIVITY_MEMBER_NOT_REGISTERED",
      durationMs: Date.now() - startedAt,
    });
    throw new ActivityMemberNotRegisteredError();
  }

  const activity = buildActivityAggregateForCreate({
    command: input.command,
    creatorMemberId: member.id,
  });

  const event = createActivityCreatedEvent({
    activity,
    correlationId,
    actorId: input.actorId,
  });

  try {
    await runMongoTransaction(async (session) => {
      await insertActivity(activity, { session });
      await enqueueDomainEvent(event, { session });
      return activity.activityId;
    });
  } catch (error) {
    logger.error("activity.creation.failed", {
      component: "activity-create",
      correlationId,
      memberId: input.creatorMemberId,
      activityId: activity.activityId,
      errorCode:
        error instanceof ActivityTransactionError
          ? error.code
          : error instanceof Error
            ? error.name
            : "unknown",
      message: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
    });

    if (error instanceof ActivityMemberNotRegisteredError) {
      throw error;
    }

    throw new ActivityTransactionError("Activity creation transaction failed.", error);
  }

  logger.info("activity.creation.completed", {
    component: "activity-create",
    correlationId,
    memberId: input.creatorMemberId,
    activityId: activity.activityId,
    aggregateVersion: activity.aggregateVersion,
    eventId: event.eventId,
    durationMs: Date.now() - startedAt,
  });

  logger.info("domain_event.enqueued", {
    component: "activity-create",
    correlationId,
    activityId: activity.activityId,
    eventId: event.eventId,
    eventName: event.eventName,
  });

  return {
    activity: toActivityDetailDto(activity),
  };
}
