import type { CanonicalDomainEventEnvelope } from "../../../infrastructure/events/domain-event.js";
import { CATALOGUE_EVENTS } from "../../../infrastructure/events/catalogue-events.js";
import type { ActivityCreatedPayload } from "../../activity/domain/activity-created.event.js";
import { logger } from "../../../shared/observability/logger.js";
import { WorkspaceProjectionValidationError } from "../workspace.errors.js";
import { buildWorkspaceRecentActivityCard } from "../infrastructure/workspace-projection.persistence.js";
import { applyActivityCreatedToWorkspaceProjection } from "../infrastructure/workspace-projection.repository.js";

export const WORKSPACE_ACTIVITY_CREATED_CONSUMER_ID = "workspace.activity-created.v1" as const;

function isActivityCreatedPayload(payload: Record<string, unknown>): payload is ActivityCreatedPayload {
  return (
    typeof payload.activityId === "string" &&
    typeof payload.creatorMemberId === "string" &&
    typeof payload.title === "string" &&
    typeof payload.activityType === "string" &&
    typeof payload.visibility === "string" &&
    typeof payload.status === "string" &&
    typeof payload.createdAt === "string"
  );
}

function assertNoCredentialFields(payload: Record<string, unknown>): void {
  for (const forbidden of ["password", "passwordHash", "token", "email", "refreshToken"]) {
    if (forbidden in payload) {
      throw new WorkspaceProjectionValidationError(
        `ActivityCreated payload must not include credential field "${forbidden}".`,
      );
    }
  }
}

export function validateActivityCreatedWorkspaceEnvelope(
  envelope: CanonicalDomainEventEnvelope,
): ActivityCreatedPayload {
  if (envelope.eventName !== CATALOGUE_EVENTS.activityCreated) {
    throw new WorkspaceProjectionValidationError(
      `Workspace Activity projection requires ${CATALOGUE_EVENTS.activityCreated}.`,
    );
  }

  assertNoCredentialFields(envelope.payload);

  if (!isActivityCreatedPayload(envelope.payload)) {
    throw new WorkspaceProjectionValidationError("ActivityCreated payload is invalid for Workspace projection.");
  }

  return envelope.payload;
}

export async function handleActivityCreatedWorkspaceProjection(
  envelope: CanonicalDomainEventEnvelope,
): Promise<void> {
  const startedAt = Date.now();
  const payload = validateActivityCreatedWorkspaceEnvelope(envelope);

  logger.info("workspace.activity_projection.started", {
    component: "workspace-activity-projection",
    consumerId: WORKSPACE_ACTIVITY_CREATED_CONSUMER_ID,
    correlationId: envelope.metadata.correlationId,
    eventId: envelope.eventId,
    activityId: payload.activityId,
    memberId: payload.creatorMemberId,
  });

  try {
    const card = buildWorkspaceRecentActivityCard({
      activityId: payload.activityId,
      title: payload.title,
      status: payload.status,
      createdAt: payload.createdAt,
      sourceEventId: envelope.eventId,
    });

    const outcome = await applyActivityCreatedToWorkspaceProjection({
      memberId: payload.creatorMemberId,
      card,
      updatedAt: envelope.metadata.occurredAt,
    });

    if (outcome === "idempotent_replay") {
      logger.info("workspace.activity_projection.idempotent_replay", {
        component: "workspace-activity-projection",
        consumerId: WORKSPACE_ACTIVITY_CREATED_CONSUMER_ID,
        correlationId: envelope.metadata.correlationId,
        eventId: envelope.eventId,
        activityId: payload.activityId,
        memberId: payload.creatorMemberId,
        durationMs: Date.now() - startedAt,
      });
      return;
    }

    logger.info("workspace.activity_projection.updated", {
      component: "workspace-activity-projection",
      consumerId: WORKSPACE_ACTIVITY_CREATED_CONSUMER_ID,
      correlationId: envelope.metadata.correlationId,
      eventId: envelope.eventId,
      activityId: payload.activityId,
      memberId: payload.creatorMemberId,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    logger.error("workspace.activity_projection.failed", {
      component: "workspace-activity-projection",
      consumerId: WORKSPACE_ACTIVITY_CREATED_CONSUMER_ID,
      correlationId: envelope.metadata.correlationId,
      eventId: envelope.eventId,
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
