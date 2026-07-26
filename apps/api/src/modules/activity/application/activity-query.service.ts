import { logger } from "../../../shared/observability/logger.js";
import { findActivityById } from "../infrastructure/activity.repository.js";
import { toActivityDetailDto } from "../infrastructure/activity.persistence.js";
import {
  ActivityForbiddenError,
  ActivityNotFoundError,
} from "../domain/activity.errors.js";
import type { ActivityDetailDto } from "../domain/activity.types.js";

export async function getActivityByIdForMember(input: {
  activityId: string;
  memberId: string;
}): Promise<ActivityDetailDto> {
  const startedAt = Date.now();
  const activity = await findActivityById(input.activityId);

  if (!activity) {
    logger.info("activity.query.not_found", {
      component: "activity-query",
      activityId: input.activityId,
      memberId: input.memberId,
      durationMs: Date.now() - startedAt,
    });
    throw new ActivityNotFoundError();
  }

  if (activity.creatorMemberId !== input.memberId) {
    logger.info("activity.query.forbidden", {
      component: "activity-query",
      activityId: input.activityId,
      memberId: input.memberId,
      durationMs: Date.now() - startedAt,
    });
    throw new ActivityForbiddenError();
  }

  const dto = toActivityDetailDto(activity);

  logger.info("activity.query.completed", {
    component: "activity-query",
    activityId: dto.activityId,
    memberId: input.memberId,
    aggregateVersion: dto.aggregateVersion,
    durationMs: Date.now() - startedAt,
  });

  return dto;
}
