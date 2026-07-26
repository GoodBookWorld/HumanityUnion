import type { CanonicalDomainEventEnvelope } from "../../../infrastructure/events/domain-event.js";
import { CATALOGUE_EVENTS } from "../../../infrastructure/events/catalogue-events.js";
import type { ProposalCreatedPayload } from "../../proposal/domain/proposal-created.event.js";
import { logger } from "../../../shared/observability/logger.js";
import { WorkspaceProjectionValidationError } from "../workspace.errors.js";
import { buildWorkspaceRecentProposalCard } from "../infrastructure/workspace-projection.persistence.js";
import { applyProposalCreatedToWorkspaceProjection } from "../infrastructure/workspace-projection.repository.js";

export const WORKSPACE_PROPOSAL_CREATED_CONSUMER_ID = "workspace.proposal-created.v1" as const;

function isProposalCreatedPayload(payload: Record<string, unknown>): payload is ProposalCreatedPayload {
  return (
    typeof payload.proposalId === "string" &&
    typeof payload.activityId === "string" &&
    (payload.discussionId === null || typeof payload.discussionId === "string") &&
    typeof payload.creatorMemberId === "string" &&
    typeof payload.title === "string" &&
    typeof payload.visibility === "string" &&
    typeof payload.status === "string" &&
    typeof payload.createdAt === "string"
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
        `ProposalCreated payload must not include forbidden field "${forbidden}".`,
      );
    }
  }
}

export function validateProposalCreatedWorkspaceEnvelope(
  envelope: CanonicalDomainEventEnvelope,
): ProposalCreatedPayload {
  if (envelope.eventName !== CATALOGUE_EVENTS.proposalCreated) {
    throw new WorkspaceProjectionValidationError(
      `Workspace Proposal projection requires ${CATALOGUE_EVENTS.proposalCreated}.`,
    );
  }

  assertNoForbiddenFields(envelope.payload);

  if (!isProposalCreatedPayload(envelope.payload)) {
    throw new WorkspaceProjectionValidationError(
      "ProposalCreated payload is invalid for Workspace projection.",
    );
  }

  return envelope.payload;
}

export async function handleProposalCreatedWorkspaceProjection(
  envelope: CanonicalDomainEventEnvelope,
): Promise<void> {
  const startedAt = Date.now();
  const payload = validateProposalCreatedWorkspaceEnvelope(envelope);

  logger.info("workspace.proposal_projection.started", {
    component: "workspace-proposal-projection",
    consumerId: WORKSPACE_PROPOSAL_CREATED_CONSUMER_ID,
    correlationId: envelope.metadata.correlationId,
    eventId: envelope.eventId,
    proposalId: payload.proposalId,
    activityId: payload.activityId,
    memberId: payload.creatorMemberId,
  });

  try {
    const card = buildWorkspaceRecentProposalCard({
      activityId: payload.activityId,
      proposalId: payload.proposalId,
      title: payload.title,
      status: payload.status,
      createdAt: payload.createdAt,
      sourceEventId: envelope.eventId,
    });

    const outcome = await applyProposalCreatedToWorkspaceProjection({
      memberId: payload.creatorMemberId,
      card,
      updatedAt: envelope.metadata.occurredAt,
    });

    if (outcome === "idempotent_replay") {
      logger.info("workspace.proposal_projection.idempotent", {
        component: "workspace-proposal-projection",
        consumerId: WORKSPACE_PROPOSAL_CREATED_CONSUMER_ID,
        correlationId: envelope.metadata.correlationId,
        eventId: envelope.eventId,
        proposalId: payload.proposalId,
        activityId: payload.activityId,
        memberId: payload.creatorMemberId,
        durationMs: Date.now() - startedAt,
      });
      return;
    }

    logger.info("workspace.proposal_projection.completed", {
      component: "workspace-proposal-projection",
      consumerId: WORKSPACE_PROPOSAL_CREATED_CONSUMER_ID,
      correlationId: envelope.metadata.correlationId,
      eventId: envelope.eventId,
      proposalId: payload.proposalId,
      activityId: payload.activityId,
      memberId: payload.creatorMemberId,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    logger.error("workspace.proposal_projection.failed", {
      component: "workspace-proposal-projection",
      consumerId: WORKSPACE_PROPOSAL_CREATED_CONSUMER_ID,
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
