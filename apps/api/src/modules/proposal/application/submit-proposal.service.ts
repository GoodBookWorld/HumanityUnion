import { enqueueDomainEvent } from "../../../infrastructure/outbox/outbox.repository.js";
import { runMongoTransaction } from "../../../infrastructure/mongodb/mongo-transaction.js";
import { getCorrelationContext } from "../../../shared/observability/correlation.js";
import { logger } from "../../../shared/observability/logger.js";
import { findActivityById } from "../../activity/infrastructure/activity.repository.js";
import { findDiscussionById } from "../../discussion/infrastructure/discussion.repository.js";
import { getMemberById } from "../../member/member-access.js";
import { createProposalSubmittedEvent } from "../domain/proposal-submitted.event.js";
import { applyProposalSubmissionTransition } from "../domain/submit-proposal.aggregate.js";
import {
  ProposalActivityNotFoundError,
  ProposalAlreadySubmittedError,
  ProposalConcurrencyConflictError,
  ProposalDiscussionActivityMismatchError,
  ProposalDiscussionNotFoundError,
  ProposalMemberNotRegisteredError,
  ProposalNotFoundError,
  ProposalSubmissionForbiddenError,
  ProposalTransactionError,
} from "../domain/proposal.errors.js";
import type { ProposalRecord, SubmitProposalCommandInput, SubmitProposalResult } from "../domain/proposal.types.js";
import {
  findProposalById,
  updateProposalForSubmission,
} from "../infrastructure/proposal.repository.js";
import { toProposalDetailDto } from "../infrastructure/proposal.persistence.js";

async function resolveSubmissionConflict(proposalId: string): Promise<never> {
  const current = await findProposalById(proposalId);

  if (!current) {
    throw new ProposalNotFoundError();
  }

  if (current.status === "submitted") {
    throw new ProposalAlreadySubmittedError();
  }

  throw new ProposalConcurrencyConflictError();
}

async function assertSubmissionReferencesExist(proposal: ProposalRecord): Promise<void> {
  const activity = await findActivityById(proposal.activityId);

  if (!activity) {
    throw new ProposalActivityNotFoundError();
  }

  if (!proposal.discussionId) {
    return;
  }

  const discussion = await findDiscussionById(proposal.discussionId);

  if (!discussion) {
    throw new ProposalDiscussionNotFoundError();
  }

  if (discussion.activityId !== proposal.activityId) {
    throw new ProposalDiscussionActivityMismatchError();
  }
}

export async function submitProposal(input: {
  memberId: string;
  actorId: string;
  command: SubmitProposalCommandInput;
  correlationId?: string;
}): Promise<SubmitProposalResult> {
  const startedAt = Date.now();
  const correlationId =
    input.correlationId ?? getCorrelationContext()?.correlationId ?? input.actorId;

  logger.info("proposal.submission.started", {
    component: "proposal-submit",
    correlationId,
    memberId: input.memberId,
    proposalId: input.command.proposalId,
  });

  const member = await getMemberById(input.memberId);

  if (!member) {
    logger.warn("proposal.submission.failed", {
      component: "proposal-submit",
      correlationId,
      memberId: input.memberId,
      proposalId: input.command.proposalId,
      errorCode: "PROPOSAL_MEMBER_NOT_REGISTERED",
      durationMs: Date.now() - startedAt,
    });
    throw new ProposalMemberNotRegisteredError();
  }

  const existing = await findProposalById(input.command.proposalId);

  if (!existing) {
    logger.warn("proposal.submission.failed", {
      component: "proposal-submit",
      correlationId,
      memberId: input.memberId,
      proposalId: input.command.proposalId,
      errorCode: "PROPOSAL_NOT_FOUND",
      durationMs: Date.now() - startedAt,
    });
    throw new ProposalNotFoundError();
  }

  if (existing.creatorMemberId !== input.memberId) {
    logger.warn("proposal.submission.failed", {
      component: "proposal-submit",
      correlationId,
      memberId: input.memberId,
      proposalId: input.command.proposalId,
      errorCode: "PROPOSAL_SUBMISSION_FORBIDDEN",
      durationMs: Date.now() - startedAt,
    });
    throw new ProposalSubmissionForbiddenError();
  }

  await assertSubmissionReferencesExist(existing);

  const previousStatus = existing.status;
  const previousAggregateVersion = existing.aggregateVersion;
  const submitted = applyProposalSubmissionTransition(existing, new Date().toISOString());
  const event = createProposalSubmittedEvent({
    proposal: submitted,
    correlationId,
    actorId: input.actorId,
  });

  try {
    const outcome = await runMongoTransaction(async (session) => {
      const updateOutcome = await updateProposalForSubmission(
        submitted,
        {
          aggregateVersion: previousAggregateVersion,
          status: previousStatus,
        },
        { session },
      );

      if (updateOutcome === "conflict") {
        return "conflict" as const;
      }

      await enqueueDomainEvent(event, { session });
      return "updated" as const;
    });

    if (outcome === "conflict") {
      logger.warn("proposal.submission.conflict", {
        component: "proposal-submit",
        correlationId,
        memberId: input.memberId,
        proposalId: input.command.proposalId,
        previousAggregateVersion,
        previousStatus,
        durationMs: Date.now() - startedAt,
      });
      await resolveSubmissionConflict(input.command.proposalId);
    }
  } catch (error) {
    logger.error("proposal.submission.failed", {
      component: "proposal-submit",
      correlationId,
      memberId: input.memberId,
      proposalId: input.command.proposalId,
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
      error instanceof ProposalNotFoundError ||
      error instanceof ProposalSubmissionForbiddenError ||
      error instanceof ProposalAlreadySubmittedError ||
      error instanceof ProposalActivityNotFoundError ||
      error instanceof ProposalDiscussionNotFoundError ||
      error instanceof ProposalDiscussionActivityMismatchError ||
      error instanceof ProposalConcurrencyConflictError
    ) {
      throw error;
    }

    throw new ProposalTransactionError("Proposal submission transaction failed.", error);
  }

  logger.info("proposal.submission.completed", {
    component: "proposal-submit",
    correlationId,
    memberId: input.memberId,
    proposalId: submitted.proposalId,
    previousAggregateVersion,
    aggregateVersion: submitted.aggregateVersion,
    previousStatus,
    status: submitted.status,
    eventId: event.eventId,
    durationMs: Date.now() - startedAt,
  });

  logger.info("domain_event.enqueued", {
    component: "proposal-submit",
    correlationId,
    proposalId: submitted.proposalId,
    activityId: submitted.activityId,
    eventId: event.eventId,
    eventName: event.eventName,
  });

  return {
    proposal: toProposalDetailDto(submitted),
  };
}
