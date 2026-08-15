import { enqueueDomainEvent } from "../../../infrastructure/outbox/outbox.repository.js";
import { runMongoTransaction } from "../../../infrastructure/mongodb/mongo-transaction.js";
import { getCorrelationContext } from "../../../shared/observability/correlation.js";
import { logger } from "../../../shared/observability/logger.js";
import { getMemberById } from "../../member/member-access.js";
import { findProposalById } from "../../proposal/infrastructure/proposal.repository.js";
import { buildDecisionAggregateForCreate } from "../domain/create-decision.aggregate.js";
import { createDecisionOpenedEvent } from "../domain/decision-opened.event.js";
import {
  DecisionAlreadyExistsError,
  DecisionCreationForbiddenError,
  DecisionMemberNotRegisteredError,
  DecisionProposalNotFoundError,
  DecisionProposalNotSubmittedError,
  DecisionTransactionError,
} from "../domain/decision.errors.js";
import type { CreateDecisionCommandInput, CreateDecisionResult } from "../domain/decision.types.js";
import {
  findDecisionByProposalId,
  insertDecision,
} from "../infrastructure/decision.repository.js";
import { toDecisionDetailDto } from "../infrastructure/decision.persistence.js";

export async function createDecision(input: {
  memberId: string;
  actorId: string;
  command: CreateDecisionCommandInput;
  correlationId?: string;
}): Promise<CreateDecisionResult> {
  const startedAt = Date.now();
  const correlationId =
    input.correlationId ?? getCorrelationContext()?.correlationId ?? input.actorId;

  logger.info("decision.creation.started", {
    component: "decision-create",
    correlationId,
    memberId: input.memberId,
    proposalId: input.command.proposalId,
  });

  const member = await getMemberById(input.memberId);

  if (!member) {
    logger.warn("decision.creation.failed", {
      component: "decision-create",
      correlationId,
      memberId: input.memberId,
      proposalId: input.command.proposalId,
      errorCode: "DECISION_MEMBER_NOT_REGISTERED",
      durationMs: Date.now() - startedAt,
    });
    throw new DecisionMemberNotRegisteredError();
  }

  const proposal = await findProposalById(input.command.proposalId);

  if (!proposal) {
    logger.warn("decision.creation.failed", {
      component: "decision-create",
      correlationId,
      memberId: input.memberId,
      proposalId: input.command.proposalId,
      errorCode: "DECISION_PROPOSAL_NOT_FOUND",
      durationMs: Date.now() - startedAt,
    });
    throw new DecisionProposalNotFoundError();
  }

  if (proposal.status !== "submitted") {
    logger.warn("decision.creation.failed", {
      component: "decision-create",
      correlationId,
      memberId: input.memberId,
      proposalId: input.command.proposalId,
      errorCode: "DECISION_PROPOSAL_NOT_SUBMITTED",
      durationMs: Date.now() - startedAt,
    });
    throw new DecisionProposalNotSubmittedError();
  }

  if (proposal.creatorMemberId !== input.memberId) {
    logger.warn("decision.creation.failed", {
      component: "decision-create",
      correlationId,
      memberId: input.memberId,
      proposalId: input.command.proposalId,
      errorCode: "DECISION_CREATION_FORBIDDEN",
      durationMs: Date.now() - startedAt,
    });
    throw new DecisionCreationForbiddenError();
  }

  const existingDecision = await findDecisionByProposalId(proposal.proposalId);

  if (existingDecision) {
    logger.warn("decision.creation.failed", {
      component: "decision-create",
      correlationId,
      memberId: input.memberId,
      proposalId: input.command.proposalId,
      decisionId: existingDecision.decisionId,
      errorCode: "DECISION_ALREADY_EXISTS",
      durationMs: Date.now() - startedAt,
    });
    throw new DecisionAlreadyExistsError();
  }

  const decision = buildDecisionAggregateForCreate({ proposal });
  const event = createDecisionOpenedEvent({
    decision,
    correlationId,
    actorId: input.actorId,
  });

  try {
    await runMongoTransaction(async (session) => {
      await insertDecision(decision, { session });
      await enqueueDomainEvent(event, { session });
      return decision.decisionId;
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      logger.warn("decision.creation.failed", {
        component: "decision-create",
        correlationId,
        memberId: input.memberId,
        proposalId: input.command.proposalId,
        errorCode: "DECISION_ALREADY_EXISTS",
        durationMs: Date.now() - startedAt,
      });
      throw new DecisionAlreadyExistsError();
    }

    logger.error("decision.creation.failed", {
      component: "decision-create",
      correlationId,
      memberId: input.memberId,
      proposalId: input.command.proposalId,
      decisionId: decision.decisionId,
      errorCode:
        error instanceof DecisionTransactionError
          ? error.code
          : error instanceof Error
            ? error.name
            : "unknown",
      message: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
    });

    if (
      error instanceof DecisionMemberNotRegisteredError ||
      error instanceof DecisionProposalNotFoundError ||
      error instanceof DecisionProposalNotSubmittedError ||
      error instanceof DecisionCreationForbiddenError ||
      error instanceof DecisionAlreadyExistsError
    ) {
      throw error;
    }

    throw new DecisionTransactionError("Decision creation transaction failed.", error);
  }

  logger.info("decision.creation.completed", {
    component: "decision-create",
    correlationId,
    memberId: input.memberId,
    proposalId: decision.proposalId,
    decisionId: decision.decisionId,
    aggregateVersion: decision.aggregateVersion,
    eventId: event.eventId,
    durationMs: Date.now() - startedAt,
  });

  logger.info("domain_event.enqueued", {
    component: "decision-create",
    correlationId,
    decisionId: decision.decisionId,
    proposalId: decision.proposalId,
    activityId: decision.activityId,
    eventId: event.eventId,
    eventName: event.eventName,
  });

  return {
    decision: toDecisionDetailDto(decision),
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11_000
  );
}
