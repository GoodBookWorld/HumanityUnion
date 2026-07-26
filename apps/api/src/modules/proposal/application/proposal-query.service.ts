import { logger } from "../../../shared/observability/logger.js";
import {
  ProposalForbiddenError,
  ProposalNotFoundError,
} from "../domain/proposal.errors.js";
import type { ProposalDetailDto } from "../domain/proposal.types.js";
import { findProposalById } from "../infrastructure/proposal.repository.js";
import { toProposalDetailDto } from "../infrastructure/proposal.persistence.js";

export async function getProposalByIdForMember(input: {
  proposalId: string;
  memberId: string;
}): Promise<ProposalDetailDto> {
  const startedAt = Date.now();
  const proposal = await findProposalById(input.proposalId);

  if (!proposal) {
    logger.info("proposal.query.not_found", {
      component: "proposal-query",
      proposalId: input.proposalId,
      memberId: input.memberId,
      durationMs: Date.now() - startedAt,
    });
    throw new ProposalNotFoundError();
  }

  const isCreator = proposal.creatorMemberId === input.memberId;
  const isPublic = proposal.visibility === "public";

  if (!isCreator && !isPublic) {
    logger.info("proposal.query.forbidden", {
      component: "proposal-query",
      proposalId: input.proposalId,
      memberId: input.memberId,
      durationMs: Date.now() - startedAt,
    });
    throw new ProposalForbiddenError();
  }

  const dto = toProposalDetailDto(proposal);

  logger.info("proposal.query.completed", {
    component: "proposal-query",
    proposalId: dto.proposalId,
    activityId: dto.activityId,
    memberId: input.memberId,
    aggregateVersion: dto.aggregateVersion,
    durationMs: Date.now() - startedAt,
  });

  return dto;
}
