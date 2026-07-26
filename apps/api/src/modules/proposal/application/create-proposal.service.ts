import { enqueueDomainEvent } from "../../../infrastructure/outbox/outbox.repository.js";
import { runMongoTransaction } from "../../../infrastructure/mongodb/mongo-transaction.js";
import { getCorrelationContext } from "../../../shared/observability/correlation.js";
import { logger } from "../../../shared/observability/logger.js";
import { findActivityById } from "../../activity/infrastructure/activity.repository.js";
import { findDiscussionById } from "../../discussion/infrastructure/discussion.repository.js";
import { getMemberById } from "../../member/member-access.js";
import { buildProposalAggregateForCreate } from "../domain/create-proposal.aggregate.js";
import { createProposalCreatedEvent } from "../domain/proposal-created.event.js";
import {
  ProposalActivityNotFoundError,
  ProposalDiscussionActivityMismatchError,
  ProposalDiscussionNotFoundError,
  ProposalMemberNotRegisteredError,
  ProposalTransactionError,
} from "../domain/proposal.errors.js";
import type { CreateProposalCommandInput, CreateProposalResult } from "../domain/proposal.types.js";
import { insertProposal } from "../infrastructure/proposal.repository.js";
import { toProposalDetailDto } from "../infrastructure/proposal.persistence.js";

export async function createProposal(input: {
  creatorMemberId: string;
  actorId: string;
  command: CreateProposalCommandInput;
  correlationId?: string;
}): Promise<CreateProposalResult> {
  const startedAt = Date.now();
  const correlationId =
    input.correlationId ?? getCorrelationContext()?.correlationId ?? input.actorId;

  logger.info("proposal.creation.started", {
    component: "proposal-create",
    correlationId,
    memberId: input.creatorMemberId,
    activityId: input.command.activityId,
    discussionId: input.command.discussionId ?? null,
  });

  const member = await getMemberById(input.creatorMemberId);

  if (!member) {
    logger.warn("proposal.creation.failed", {
      component: "proposal-create",
      correlationId,
      memberId: input.creatorMemberId,
      activityId: input.command.activityId,
      errorCode: "PROPOSAL_MEMBER_NOT_REGISTERED",
      durationMs: Date.now() - startedAt,
    });
    throw new ProposalMemberNotRegisteredError();
  }

  const activity = await findActivityById(input.command.activityId);

  if (!activity) {
    logger.warn("proposal.creation.failed", {
      component: "proposal-create",
      correlationId,
      memberId: input.creatorMemberId,
      activityId: input.command.activityId,
      errorCode: "PROPOSAL_ACTIVITY_NOT_FOUND",
      durationMs: Date.now() - startedAt,
    });
    throw new ProposalActivityNotFoundError();
  }

  if (input.command.discussionId) {
    const discussion = await findDiscussionById(input.command.discussionId);

    if (!discussion) {
      logger.warn("proposal.creation.failed", {
        component: "proposal-create",
        correlationId,
        memberId: input.creatorMemberId,
        activityId: input.command.activityId,
        discussionId: input.command.discussionId,
        errorCode: "PROPOSAL_DISCUSSION_NOT_FOUND",
        durationMs: Date.now() - startedAt,
      });
      throw new ProposalDiscussionNotFoundError();
    }

    if (discussion.activityId !== input.command.activityId) {
      logger.warn("proposal.creation.failed", {
        component: "proposal-create",
        correlationId,
        memberId: input.creatorMemberId,
        activityId: input.command.activityId,
        discussionId: input.command.discussionId,
        errorCode: "PROPOSAL_DISCUSSION_ACTIVITY_MISMATCH",
        durationMs: Date.now() - startedAt,
      });
      throw new ProposalDiscussionActivityMismatchError();
    }
  }

  const proposal = buildProposalAggregateForCreate({
    command: input.command,
    creatorMemberId: member.id,
    activity,
  });

  const event = createProposalCreatedEvent({
    proposal,
    correlationId,
    actorId: input.actorId,
  });

  try {
    await runMongoTransaction(async (session) => {
      await insertProposal(proposal, { session });
      await enqueueDomainEvent(event, { session });
      return proposal.proposalId;
    });
  } catch (error) {
    logger.error("proposal.creation.failed", {
      component: "proposal-create",
      correlationId,
      memberId: input.creatorMemberId,
      activityId: input.command.activityId,
      proposalId: proposal.proposalId,
      errorCode:
        error instanceof ProposalTransactionError
          ? error.code
          : error instanceof Error
            ? error.name
            : "unknown",
      message: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
    });

    if (
      error instanceof ProposalMemberNotRegisteredError ||
      error instanceof ProposalActivityNotFoundError ||
      error instanceof ProposalDiscussionNotFoundError ||
      error instanceof ProposalDiscussionActivityMismatchError
    ) {
      throw error;
    }

    throw new ProposalTransactionError("Proposal creation transaction failed.", error);
  }

  logger.info("proposal.creation.completed", {
    component: "proposal-create",
    correlationId,
    memberId: input.creatorMemberId,
    activityId: input.command.activityId,
    proposalId: proposal.proposalId,
    aggregateVersion: proposal.aggregateVersion,
    eventId: event.eventId,
    durationMs: Date.now() - startedAt,
  });

  logger.info("domain_event.enqueued", {
    component: "proposal-create",
    correlationId,
    proposalId: proposal.proposalId,
    activityId: proposal.activityId,
    eventId: event.eventId,
    eventName: event.eventName,
  });

  return {
    proposal: toProposalDetailDto(proposal),
  };
}
