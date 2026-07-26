import { logger } from "../../../shared/observability/logger.js";
import {
  DecisionForbiddenError,
  DecisionNotFoundError,
} from "../domain/decision.errors.js";
import type { DecisionDetailDto } from "../domain/decision.types.js";
import { findDecisionById } from "../infrastructure/decision.repository.js";
import { toDecisionDetailDto } from "../infrastructure/decision.persistence.js";

export async function getDecisionByIdForMember(input: {
  decisionId: string;
  memberId: string;
}): Promise<DecisionDetailDto> {
  const startedAt = Date.now();
  const decision = await findDecisionById(input.decisionId);

  if (!decision) {
    logger.info("decision.query.not_found", {
      component: "decision-query",
      decisionId: input.decisionId,
      memberId: input.memberId,
      durationMs: Date.now() - startedAt,
    });
    throw new DecisionNotFoundError();
  }

  const isCreator = decision.creatorMemberId === input.memberId;
  const isPublic = decision.visibility === "public";

  if (!isCreator && !isPublic) {
    logger.info("decision.query.forbidden", {
      component: "decision-query",
      decisionId: input.decisionId,
      memberId: input.memberId,
      durationMs: Date.now() - startedAt,
    });
    throw new DecisionForbiddenError();
  }

  const dto = toDecisionDetailDto(decision);

  logger.info("decision.query.completed", {
    component: "decision-query",
    decisionId: dto.decisionId,
    proposalId: dto.proposalId,
    activityId: dto.activityId,
    memberId: input.memberId,
    aggregateVersion: dto.aggregateVersion,
    durationMs: Date.now() - startedAt,
  });

  return dto;
}
