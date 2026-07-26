import { logger } from "../../../shared/observability/logger.js";
import {
  DiscussionForbiddenError,
  DiscussionNotFoundError,
} from "../domain/discussion.errors.js";
import type { DiscussionDetailDto } from "../domain/discussion.types.js";
import { findDiscussionById } from "../infrastructure/discussion.repository.js";
import { toDiscussionDetailDto } from "../infrastructure/discussion.persistence.js";

export async function getDiscussionByIdForMember(input: {
  discussionId: string;
  memberId: string;
}): Promise<DiscussionDetailDto> {
  const startedAt = Date.now();
  const discussion = await findDiscussionById(input.discussionId);

  if (!discussion) {
    logger.info("discussion.query.not_found", {
      component: "discussion-query",
      discussionId: input.discussionId,
      memberId: input.memberId,
      durationMs: Date.now() - startedAt,
    });
    throw new DiscussionNotFoundError();
  }

  if (discussion.creatorMemberId !== input.memberId) {
    logger.info("discussion.query.forbidden", {
      component: "discussion-query",
      discussionId: input.discussionId,
      memberId: input.memberId,
      durationMs: Date.now() - startedAt,
    });
    throw new DiscussionForbiddenError();
  }

  const dto = toDiscussionDetailDto(discussion);

  logger.info("discussion.query.completed", {
    component: "discussion-query",
    discussionId: dto.discussionId,
    activityId: dto.activityId,
    memberId: input.memberId,
    aggregateVersion: dto.aggregateVersion,
    durationMs: Date.now() - startedAt,
  });

  return dto;
}
