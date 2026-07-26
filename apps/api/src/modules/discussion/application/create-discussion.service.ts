import { enqueueDomainEvent } from "../../../infrastructure/outbox/outbox.repository.js";
import { runMongoTransaction } from "../../../infrastructure/mongodb/mongo-transaction.js";
import { getCorrelationContext } from "../../../shared/observability/correlation.js";
import { logger } from "../../../shared/observability/logger.js";
import { findActivityById } from "../../activity/infrastructure/activity.repository.js";
import { getMemberById } from "../../member/member-access.js";
import { createDiscussionCreatedEvent } from "../domain/discussion-created.event.js";
import { buildDiscussionAggregateForCreate } from "../domain/create-discussion.aggregate.js";
import {
  DiscussionActivityNotFoundError,
  DiscussionMemberNotRegisteredError,
  DiscussionTransactionError,
} from "../domain/discussion.errors.js";
import type { CreateDiscussionCommandInput, CreateDiscussionResult } from "../domain/discussion.types.js";
import { insertDiscussion } from "../infrastructure/discussion.repository.js";
import { toDiscussionDetailDto } from "../infrastructure/discussion.persistence.js";

export async function createDiscussion(input: {
  creatorMemberId: string;
  actorId: string;
  command: CreateDiscussionCommandInput;
  correlationId?: string;
}): Promise<CreateDiscussionResult> {
  const startedAt = Date.now();
  const correlationId =
    input.correlationId ?? getCorrelationContext()?.correlationId ?? input.actorId;

  logger.info("discussion.creation.started", {
    component: "discussion-create",
    correlationId,
    memberId: input.creatorMemberId,
    activityId: input.command.activityId,
  });

  const member = await getMemberById(input.creatorMemberId);

  if (!member) {
    logger.warn("discussion.creation.failed", {
      component: "discussion-create",
      correlationId,
      memberId: input.creatorMemberId,
      activityId: input.command.activityId,
      errorCode: "DISCUSSION_MEMBER_NOT_REGISTERED",
      durationMs: Date.now() - startedAt,
    });
    throw new DiscussionMemberNotRegisteredError();
  }

  const activity = await findActivityById(input.command.activityId);

  if (!activity) {
    logger.warn("discussion.creation.failed", {
      component: "discussion-create",
      correlationId,
      memberId: input.creatorMemberId,
      activityId: input.command.activityId,
      errorCode: "DISCUSSION_ACTIVITY_NOT_FOUND",
      durationMs: Date.now() - startedAt,
    });
    throw new DiscussionActivityNotFoundError();
  }

  const discussion = buildDiscussionAggregateForCreate({
    command: input.command,
    creatorMemberId: member.id,
    activity,
  });

  const event = createDiscussionCreatedEvent({
    discussion,
    correlationId,
    actorId: input.actorId,
  });

  try {
    await runMongoTransaction(async (session) => {
      await insertDiscussion(discussion, { session });
      await enqueueDomainEvent(event, { session });
      return discussion.discussionId;
    });
  } catch (error) {
    logger.error("discussion.creation.failed", {
      component: "discussion-create",
      correlationId,
      memberId: input.creatorMemberId,
      activityId: input.command.activityId,
      discussionId: discussion.discussionId,
      errorCode:
        error instanceof DiscussionTransactionError
          ? error.code
          : error instanceof Error
            ? error.name
            : "unknown",
      message: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
    });

    if (
      error instanceof DiscussionMemberNotRegisteredError ||
      error instanceof DiscussionActivityNotFoundError
    ) {
      throw error;
    }

    throw new DiscussionTransactionError("Discussion creation transaction failed.", error);
  }

  logger.info("discussion.creation.completed", {
    component: "discussion-create",
    correlationId,
    memberId: input.creatorMemberId,
    activityId: input.command.activityId,
    discussionId: discussion.discussionId,
    aggregateVersion: discussion.aggregateVersion,
    eventId: event.eventId,
    durationMs: Date.now() - startedAt,
  });

  logger.info("domain_event.enqueued", {
    component: "discussion-create",
    correlationId,
    discussionId: discussion.discussionId,
    activityId: discussion.activityId,
    eventId: event.eventId,
    eventName: event.eventName,
  });

  return {
    discussion: toDiscussionDetailDto(discussion),
  };
}
