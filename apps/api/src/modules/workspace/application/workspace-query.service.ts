import type { CanonicalDomainEventEnvelope } from "../../../infrastructure/events/domain-event.js";
import { getMemberById } from "../../member/member-access.js";
import { logger } from "../../../shared/observability/logger.js";
import type { WorkspaceOverviewDto } from "../domain/workspace-projection.types.js";
import {
  toPendingWorkspaceOverviewDto,
  toWorkspaceOverviewDto,
} from "../infrastructure/workspace-projection.persistence.js";
import { findWorkspaceProjectionByMemberId } from "../infrastructure/workspace-projection.repository.js";
import {
  WorkspaceMemberNotRegisteredError,
  WorkspaceQueryUnavailableError,
} from "../workspace.errors.js";
import { initializeWorkspaceFromMemberRegisteredEnvelope } from "./member-registered.workspace-handler.js";

export async function getWorkspaceOverviewForMember(
  memberId: string,
): Promise<WorkspaceOverviewDto> {
  const startedAt = Date.now();

  let projection;

  try {
    projection = await findWorkspaceProjectionByMemberId(memberId);
  } catch (error) {
    if (error instanceof WorkspaceQueryUnavailableError) {
      throw error;
    }

    throw error;
  }

  if (projection) {
    const dto = toWorkspaceOverviewDto(projection);

    logger.info("workspace.query.completed", {
      component: "workspace-query",
      memberId,
      workspaceId: dto.workspaceId,
      projectionStatus: dto.projectionStatus,
      projectionVersion: dto.projectionVersion,
      durationMs: Date.now() - startedAt,
    });

    return dto;
  }

  const member = await getMemberById(memberId);

  if (!member) {
    throw new WorkspaceMemberNotRegisteredError();
  }

  const pendingDto = toPendingWorkspaceOverviewDto({
    memberId,
    memberSummary: {
      displayName: member.profile.displayName,
      uniqueName: member.profile.uniqueName,
      verificationLevel: member.verificationLevel,
    },
  });

  logger.info("workspace.query.projection_pending", {
    component: "workspace-query",
    memberId,
    workspaceId: pendingDto.workspaceId,
    projectionStatus: pendingDto.projectionStatus,
    durationMs: Date.now() - startedAt,
  });

  return pendingDto;
}

export async function rebuildWorkspaceProjectionFromMemberRegistered(
  envelope: CanonicalDomainEventEnvelope,
): Promise<"created" | "idempotent_replay"> {
  const payload = envelope.payload;

  if (typeof payload.memberId !== "string") {
    throw new Error("MemberRegistered envelope is missing memberId.");
  }

  const { deleteWorkspaceProjectionByMemberId } = await import(
    "../infrastructure/workspace-projection.repository.js"
  );

  await deleteWorkspaceProjectionByMemberId(payload.memberId);

  return initializeWorkspaceFromMemberRegisteredEnvelope(envelope);
}
