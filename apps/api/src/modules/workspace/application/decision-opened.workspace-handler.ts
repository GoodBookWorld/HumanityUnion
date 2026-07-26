import type { CanonicalDomainEventEnvelope } from "../../../infrastructure/events/domain-event.js";
import { CATALOGUE_EVENTS } from "../../../infrastructure/events/catalogue-events.js";
import type { DecisionOpenedPayload } from "../../decision/domain/decision-opened.event.js";
import { logger } from "../../../shared/observability/logger.js";
import { WorkspaceProjectionValidationError } from "../workspace.errors.js";
import { buildWorkspaceRecentDecisionCard } from "../infrastructure/workspace-projection.persistence.js";
import { applyDecisionOpenedToWorkspaceProjection } from "../infrastructure/workspace-projection.repository.js";

export const WORKSPACE_DECISION_OPENED_CONSUMER_ID = "workspace.decision-opened.v1" as const;

function isDecisionOpenedPayload(
  payload: Record<string, unknown>,
): payload is DecisionOpenedPayload {
  return (
    typeof payload.decisionId === "string" &&
    typeof payload.proposalId === "string" &&
    typeof payload.activityId === "string" &&
    typeof payload.creatorMemberId === "string" &&
    typeof payload.title === "string" &&
    typeof payload.status === "string" &&
    typeof payload.visibility === "string" &&
    typeof payload.aggregateVersion === "number" &&
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
    "vote",
    "votes",
  ]) {
    if (forbidden in payload) {
      throw new WorkspaceProjectionValidationError(
        `DecisionOpened payload must not include forbidden field "${forbidden}".`,
      );
    }
  }
}

export function validateDecisionOpenedWorkspaceEnvelope(
  envelope: CanonicalDomainEventEnvelope,
): DecisionOpenedPayload {
  if (envelope.eventName !== CATALOGUE_EVENTS.decisionOpened) {
    throw new WorkspaceProjectionValidationError(
      `Workspace Decision projection requires ${CATALOGUE_EVENTS.decisionOpened}.`,
    );
  }

  assertNoForbiddenFields(envelope.payload);

  if (!isDecisionOpenedPayload(envelope.payload)) {
    throw new WorkspaceProjectionValidationError(
      "DecisionOpened payload is invalid for Workspace projection.",
    );
  }

  return envelope.payload;
}

export async function handleDecisionOpenedWorkspaceProjection(
  envelope: CanonicalDomainEventEnvelope,
): Promise<void> {
  const startedAt = Date.now();
  const payload = validateDecisionOpenedWorkspaceEnvelope(envelope);

  logger.info("workspace.decision_projection.started", {
    component: "workspace-decision-projection",
    consumerId: WORKSPACE_DECISION_OPENED_CONSUMER_ID,
    correlationId: envelope.metadata.correlationId,
    eventId: envelope.eventId,
    decisionId: payload.decisionId,
    proposalId: payload.proposalId,
    activityId: payload.activityId,
    memberId: payload.creatorMemberId,
  });

  try {
    const card = buildWorkspaceRecentDecisionCard({
      activityId: payload.activityId,
      proposalId: payload.proposalId,
      decisionId: payload.decisionId,
      title: payload.title,
      status: payload.status,
      createdAt: payload.createdAt,
      sourceEventId: envelope.eventId,
    });

    const outcome = await applyDecisionOpenedToWorkspaceProjection({
      memberId: payload.creatorMemberId,
      card,
      updatedAt: envelope.metadata.occurredAt,
    });

    if (outcome === "idempotent_replay") {
      logger.info("workspace.decision_projection.idempotent", {
        component: "workspace-decision-projection",
        consumerId: WORKSPACE_DECISION_OPENED_CONSUMER_ID,
        correlationId: envelope.metadata.correlationId,
        eventId: envelope.eventId,
        decisionId: payload.decisionId,
        proposalId: payload.proposalId,
        activityId: payload.activityId,
        memberId: payload.creatorMemberId,
        durationMs: Date.now() - startedAt,
      });
      return;
    }

    logger.info("workspace.decision_projection.completed", {
      component: "workspace-decision-projection",
      consumerId: WORKSPACE_DECISION_OPENED_CONSUMER_ID,
      correlationId: envelope.metadata.correlationId,
      eventId: envelope.eventId,
      decisionId: payload.decisionId,
      proposalId: payload.proposalId,
      activityId: payload.activityId,
      memberId: payload.creatorMemberId,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    logger.error("workspace.decision_projection.failed", {
      component: "workspace-decision-projection",
      consumerId: WORKSPACE_DECISION_OPENED_CONSUMER_ID,
      correlationId: envelope.metadata.correlationId,
      eventId: envelope.eventId,
      decisionId: payload.decisionId,
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
