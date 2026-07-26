import type { CanonicalDomainEventEnvelope } from "../../../infrastructure/events/domain-event.js";
import { CATALOGUE_EVENTS } from "../../../infrastructure/events/catalogue-events.js";
import type { MemberRegisteredPayload } from "../../member/domain/member-registered.event.js";
import { logger } from "../../../shared/observability/logger.js";
import { WorkspaceProjectionValidationError } from "../workspace.errors.js";
import { buildWorkspaceProjectionFromMemberRegistered } from "../infrastructure/workspace-projection.persistence.js";
import { insertWorkspaceProjectionIfAbsent } from "../infrastructure/workspace-projection.repository.js";

export const WORKSPACE_MEMBER_REGISTERED_CONSUMER_ID = "workspace.member-registered.v1" as const;

function isMemberRegisteredPayload(payload: Record<string, unknown>): payload is MemberRegisteredPayload {
  return (
    typeof payload.memberId === "string" &&
    typeof payload.identityId === "string" &&
    typeof payload.displayName === "string" &&
    typeof payload.uniqueName === "string" &&
    typeof payload.verificationLevel === "string" &&
    typeof payload.registeredAt === "string"
  );
}

function assertNoCredentialFields(payload: Record<string, unknown>): void {
  for (const forbidden of ["password", "passwordHash", "token", "email", "refreshToken"]) {
    if (forbidden in payload) {
      throw new WorkspaceProjectionValidationError(
        `MemberRegistered payload must not include credential field "${forbidden}".`,
      );
    }
  }
}

export function validateMemberRegisteredWorkspaceEnvelope(
  envelope: CanonicalDomainEventEnvelope,
): MemberRegisteredPayload {
  if (envelope.eventName !== CATALOGUE_EVENTS.memberRegistered) {
    throw new WorkspaceProjectionValidationError(
      `Workspace projection requires ${CATALOGUE_EVENTS.memberRegistered}.`,
    );
  }

  assertNoCredentialFields(envelope.payload);

  if (!isMemberRegisteredPayload(envelope.payload)) {
    throw new WorkspaceProjectionValidationError("MemberRegistered payload is invalid for Workspace projection.");
  }

  return envelope.payload;
}

export async function initializeWorkspaceFromMemberRegisteredEnvelope(
  envelope: CanonicalDomainEventEnvelope,
): Promise<"created" | "idempotent_replay"> {
  const payload = validateMemberRegisteredWorkspaceEnvelope(envelope);
  const startedAt = Date.now();

  logger.info("workspace.projection.initialization_started", {
    component: "workspace-projection",
    consumerId: WORKSPACE_MEMBER_REGISTERED_CONSUMER_ID,
    correlationId: envelope.metadata.correlationId,
    eventId: envelope.eventId,
    memberId: payload.memberId,
    workspaceId: `workspace:${payload.memberId}`,
  });

  const record = buildWorkspaceProjectionFromMemberRegistered({
    payload,
    eventId: envelope.eventId,
    correlationId: envelope.metadata.correlationId,
    occurredAt: envelope.metadata.occurredAt,
  });

  const outcome = await insertWorkspaceProjectionIfAbsent(record);

  if (outcome === "created") {
    logger.info("workspace.projection.initialized", {
      component: "workspace-projection",
      consumerId: WORKSPACE_MEMBER_REGISTERED_CONSUMER_ID,
      correlationId: envelope.metadata.correlationId,
      eventId: envelope.eventId,
      memberId: payload.memberId,
      workspaceId: record.workspaceId,
      projectionVersion: record.projectionVersion,
      durationMs: Date.now() - startedAt,
    });

    return outcome;
  }

  logger.info("workspace.projection.idempotent_replay", {
    component: "workspace-projection",
    consumerId: WORKSPACE_MEMBER_REGISTERED_CONSUMER_ID,
    correlationId: envelope.metadata.correlationId,
    eventId: envelope.eventId,
    memberId: payload.memberId,
    workspaceId: record.workspaceId,
    projectionVersion: record.projectionVersion,
    durationMs: Date.now() - startedAt,
  });

  return outcome;
}

export async function handleMemberRegisteredWorkspaceProjection(
  envelope: CanonicalDomainEventEnvelope,
): Promise<void> {
  try {
    await initializeWorkspaceFromMemberRegisteredEnvelope(envelope);
  } catch (error) {
    logger.error("workspace.projection.failed", {
      component: "workspace-projection",
      consumerId: WORKSPACE_MEMBER_REGISTERED_CONSUMER_ID,
      correlationId: envelope.metadata.correlationId,
      eventId: envelope.eventId,
      memberId:
        typeof envelope.payload.memberId === "string" ? envelope.payload.memberId : undefined,
      errorCode:
        error instanceof WorkspaceProjectionValidationError
          ? error.code
          : error instanceof Error
            ? error.name
            : "unknown",
      message: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}
