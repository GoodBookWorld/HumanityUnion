import type { CanonicalDomainEventEnvelope } from "../../../infrastructure/events/domain-event.js";
import { CATALOGUE_EVENTS } from "../../../infrastructure/events/catalogue-events.js";
import type { DiscussionCreatedPayload } from "../../discussion/domain/discussion-created.event.js";
import { logger } from "../../../shared/observability/logger.js";
import { WorkspaceProjectionValidationError } from "../workspace.errors.js";
import { buildWorkspaceRecentDiscussionCard } from "../infrastructure/workspace-projection.persistence.js";
import { applyDiscussionCreatedToWorkspaceProjection } from "../infrastructure/workspace-projection.repository.js";

export const WORKSPACE_DISCUSSION_CREATED_CONSUMER_ID = "workspace.discussion-created.v1" as const;

function isDiscussionCreatedPayload(
  payload: Record<string, unknown>,
): payload is DiscussionCreatedPayload {
  return (
    typeof payload.discussionId === "string" &&
    typeof payload.activityId === "string" &&
    typeof payload.creatorMemberId === "string" &&
    typeof payload.title === "string" &&
    typeof payload.visibility === "string" &&
    typeof payload.status === "string" &&
    typeof payload.createdAt === "string"
  );
}

function assertNoCredentialFields(payload: Record<string, unknown>): void {
  for (const forbidden of ["password", "passwordHash", "token", "email", "refreshToken", "openingMessage"]) {
    if (forbidden in payload) {
      throw new WorkspaceProjectionValidationError(
        `DiscussionCreated payload must not include forbidden field "${forbidden}".`,
      );
    }
  }
}

export function validateDiscussionCreatedWorkspaceEnvelope(
  envelope: CanonicalDomainEventEnvelope,
): DiscussionCreatedPayload {
  if (envelope.eventName !== CATALOGUE_EVENTS.discussionCreated) {
    throw new WorkspaceProjectionValidationError(
      `Workspace Discussion projection requires ${CATALOGUE_EVENTS.discussionCreated}.`,
    );
  }

  assertNoCredentialFields(envelope.payload);

  if (!isDiscussionCreatedPayload(envelope.payload)) {
    throw new WorkspaceProjectionValidationError(
      "DiscussionCreated payload is invalid for Workspace projection.",
    );
  }

  return envelope.payload;
}

export async function handleDiscussionCreatedWorkspaceProjection(
  envelope: CanonicalDomainEventEnvelope,
): Promise<void> {
  const startedAt = Date.now();
  const payload = validateDiscussionCreatedWorkspaceEnvelope(envelope);

  logger.info("workspace.discussion_projection.started", {
    component: "workspace-discussion-projection",
    consumerId: WORKSPACE_DISCUSSION_CREATED_CONSUMER_ID,
    correlationId: envelope.metadata.correlationId,
    eventId: envelope.eventId,
    discussionId: payload.discussionId,
    activityId: payload.activityId,
    memberId: payload.creatorMemberId,
  });

  try {
    const card = buildWorkspaceRecentDiscussionCard({
      activityId: payload.activityId,
      discussionId: payload.discussionId,
      title: payload.title,
      status: payload.status,
      createdAt: payload.createdAt,
      sourceEventId: envelope.eventId,
    });

    const outcome = await applyDiscussionCreatedToWorkspaceProjection({
      memberId: payload.creatorMemberId,
      card,
      updatedAt: envelope.metadata.occurredAt,
    });

    if (outcome === "idempotent_replay") {
      logger.info("workspace.discussion_projection.idempotent_replay", {
        component: "workspace-discussion-projection",
        consumerId: WORKSPACE_DISCUSSION_CREATED_CONSUMER_ID,
        correlationId: envelope.metadata.correlationId,
        eventId: envelope.eventId,
        discussionId: payload.discussionId,
        activityId: payload.activityId,
        memberId: payload.creatorMemberId,
        durationMs: Date.now() - startedAt,
      });
      return;
    }

    logger.info("workspace.discussion_projection.updated", {
      component: "workspace-discussion-projection",
      consumerId: WORKSPACE_DISCUSSION_CREATED_CONSUMER_ID,
      correlationId: envelope.metadata.correlationId,
      eventId: envelope.eventId,
      discussionId: payload.discussionId,
      activityId: payload.activityId,
      memberId: payload.creatorMemberId,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    logger.error("workspace.discussion_projection.failed", {
      component: "workspace-discussion-projection",
      consumerId: WORKSPACE_DISCUSSION_CREATED_CONSUMER_ID,
      correlationId: envelope.metadata.correlationId,
      eventId: envelope.eventId,
      discussionId: payload.discussionId,
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
