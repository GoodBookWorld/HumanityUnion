import type { CanonicalDomainEventEnvelope } from "../../../infrastructure/events/domain-event.js";
import { CATALOGUE_EVENTS } from "../../../infrastructure/events/catalogue-events.js";
import type { ProposalSubmittedPayload } from "../../proposal/domain/proposal-submitted.event.js";
import { logger } from "../../../shared/observability/logger.js";
import {
  WorkspaceProjectionOrderingNotReadyError,
  WorkspaceProjectionValidationError,
} from "../workspace.errors.js";
import { applyProposalSubmittedToWorkspaceProjection } from "../infrastructure/workspace-projection.repository.js";

export const WORKSPACE_PROPOSAL_SUBMITTED_CONSUMER_ID = "workspace.proposal-submitted.v1" as const;

function isProposalSubmittedPayload(
  payload: Record<string, unknown>,
): payload is ProposalSubmittedPayload {
  return (
    typeof payload.proposalId === "string" &&
    typeof payload.activityId === "string" &&
    (payload.discussionId === null || typeof payload.discussionId === "string") &&
    typeof payload.creatorMemberId === "string" &&
    typeof payload.title === "string" &&
    payload.status === "submitted" &&
    typeof payload.visibility === "string" &&
    typeof payload.aggregateVersion === "number" &&
    typeof payload.updatedAt === "string"
  );
}

function assertNoForbiddenFields(payload: Record<string, unknown>): void {
  for (const forbidden of [
    "password",
    "passwordHash",
    "token",
    "email",
    "refreshToken",
    "proposalText",
    "summary",
  ]) {
    if (forbidden in payload) {
      throw new WorkspaceProjectionValidationError(
        `ProposalSubmitted payload must not include forbidden field "${forbidden}".`,
      );
    }
  }
}

export function validateProposalSubmittedWorkspaceEnvelope(
  envelope: CanonicalDomainEventEnvelope,
): ProposalSubmittedPayload {
  if (envelope.eventName !== CATALOGUE_EVENTS.proposalSubmitted) {
    throw new WorkspaceProjectionValidationError(
      `Workspace Proposal submission projection requires ${CATALOGUE_EVENTS.proposalSubmitted}.`,
    );
  }

  assertNoForbiddenFields(envelope.payload);

  if (!isProposalSubmittedPayload(envelope.payload)) {
    throw new WorkspaceProjectionValidationError(
      "ProposalSubmitted payload is invalid for Workspace projection.",
    );
  }

  return envelope.payload;
}

export async function handleProposalSubmittedWorkspaceProjection(
  envelope: CanonicalDomainEventEnvelope,
): Promise<void> {
  const startedAt = Date.now();
  const payload = validateProposalSubmittedWorkspaceEnvelope(envelope);

  logger.info("workspace.proposal_submission_projection.started", {
    component: "workspace-proposal-submission-projection",
    consumerId: WORKSPACE_PROPOSAL_SUBMITTED_CONSUMER_ID,
    correlationId: envelope.metadata.correlationId,
    eventId: envelope.eventId,
    proposalId: payload.proposalId,
    activityId: payload.activityId,
    memberId: payload.creatorMemberId,
    aggregateVersion: payload.aggregateVersion,
  });

  try {
    const outcome = await applyProposalSubmittedToWorkspaceProjection({
      memberId: payload.creatorMemberId,
      proposalId: payload.proposalId,
      status: payload.status,
      sourceEventId: envelope.eventId,
      transitionAt: payload.updatedAt,
      workspaceUpdatedAt: envelope.metadata.occurredAt,
    });

    if (outcome === "idempotent_replay") {
      logger.info("workspace.proposal_submission_projection.idempotent", {
        component: "workspace-proposal-submission-projection",
        consumerId: WORKSPACE_PROPOSAL_SUBMITTED_CONSUMER_ID,
        correlationId: envelope.metadata.correlationId,
        eventId: envelope.eventId,
        proposalId: payload.proposalId,
        activityId: payload.activityId,
        memberId: payload.creatorMemberId,
        aggregateVersion: payload.aggregateVersion,
        durationMs: Date.now() - startedAt,
      });
      return;
    }

    logger.info("workspace.proposal_submission_projection.completed", {
      component: "workspace-proposal-submission-projection",
      consumerId: WORKSPACE_PROPOSAL_SUBMITTED_CONSUMER_ID,
      correlationId: envelope.metadata.correlationId,
      eventId: envelope.eventId,
      proposalId: payload.proposalId,
      activityId: payload.activityId,
      memberId: payload.creatorMemberId,
      aggregateVersion: payload.aggregateVersion,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    if (error instanceof WorkspaceProjectionOrderingNotReadyError) {
      logger.warn("workspace.proposal_submission_projection.retryable_ordering_failure", {
        component: "workspace-proposal-submission-projection",
        consumerId: WORKSPACE_PROPOSAL_SUBMITTED_CONSUMER_ID,
        correlationId: envelope.metadata.correlationId,
        eventId: envelope.eventId,
        proposalId: payload.proposalId,
        activityId: payload.activityId,
        memberId: payload.creatorMemberId,
        errorCode: error.code,
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }

    logger.error("workspace.proposal_submission_projection.failed", {
      component: "workspace-proposal-submission-projection",
      consumerId: WORKSPACE_PROPOSAL_SUBMITTED_CONSUMER_ID,
      correlationId: envelope.metadata.correlationId,
      eventId: envelope.eventId,
      proposalId: payload.proposalId,
      activityId: payload.activityId,
      memberId: payload.creatorMemberId,
      errorCode:
        error instanceof WorkspaceProjectionValidationError
          ? error.code
          : error instanceof Error
            ? error.name
            : "unknown",
      message: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
    });

    throw error;
  }
}
