import type { AdminInitiativeBlockCommandResult, Initiative } from "@hu/types";
import { isInitiativeAdministrativelyBlocked } from "@hu/types";

import { findAuthUserById } from "../auth/auth-user.repository.js";
import { getInitiativeById, updateInitiative } from "../initiatives/initiative.store.js";
import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
  AdministrationValidationError,
} from "./administration.errors.js";
import { record } from "./audit.service.js";

export class AdminInitiativeModerationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminInitiativeModerationValidationError";
  }
}

export interface AdminInitiativeBlockCommandInput {
  actorUserId: string;
  initiativeId: string;
  reason?: string;
}

async function assertAdminActor(userId: string): Promise<{ memberId: string }> {
  if (!userId.trim()) {
    throw new AdministrationUnauthorizedError("Authentication is required.");
  }

  const user = await findAuthUserById(userId);
  if (!user || user.role !== "admin") {
    throw new AdministrationForbiddenError("Administrator access is required.");
  }

  return { memberId: user.memberId };
}

function requireInitiative(initiativeId: string): Initiative {
  const initiative = getInitiativeById(initiativeId);
  if (!initiative) {
    throw new AdminInitiativeModerationValidationError("Initiative not found.");
  }
  return initiative;
}

/**
 * Fix 08C — Admin soft-block for STANDARD Initiatives and PUBLIC_CHOICE elections.
 * Does not change visibility.policy, closedAt, retention, or lifecycle phase.
 */
export async function blockAdminInitiative(
  input: AdminInitiativeBlockCommandInput,
): Promise<AdminInitiativeBlockCommandResult> {
  const admin = await assertAdminActor(input.actorUserId);
  const initiative = requireInitiative(input.initiativeId);

  if (isInitiativeAdministrativelyBlocked(initiative)) {
    throw new AdminInitiativeModerationValidationError("Initiative is already blocked.");
  }

  const reason = input.reason?.trim() || undefined;
  if (reason && reason.length > 500) {
    throw new AdministrationValidationError("Reason must be at most 500 characters.");
  }

  const now = new Date().toISOString();
  const updated = updateInitiative(initiative.initiativeId, {
    administrativelyBlocked: true,
    administrativelyBlockedAt: now,
    administrativelyBlockedByParticipantId: admin.memberId,
    administrativeBlockReason: reason ?? null,
  });

  if (!updated) {
    throw new AdminInitiativeModerationValidationError("Initiative not found.");
  }

  const audit = await record({
    actorParticipantId: admin.memberId,
    action: "initiative.administrative.block",
    targetType: "initiative",
    targetId: initiative.initiativeId,
    reason,
    beforeSummary: "administrativelyBlocked=false",
    afterSummary: "administrativelyBlocked=true",
  });

  return {
    initiativeId: initiative.initiativeId,
    administrativelyBlocked: true,
    auditId: audit.auditId,
  };
}

/**
 * Fix 08C — Admin-only unblock. Does not reopen CLOSED Public Choice elections.
 */
export async function unblockAdminInitiative(
  input: AdminInitiativeBlockCommandInput,
): Promise<AdminInitiativeBlockCommandResult> {
  const admin = await assertAdminActor(input.actorUserId);
  const initiative = requireInitiative(input.initiativeId);

  if (!isInitiativeAdministrativelyBlocked(initiative)) {
    throw new AdminInitiativeModerationValidationError("Initiative is not blocked.");
  }

  const updated = updateInitiative(initiative.initiativeId, {
    administrativelyBlocked: false,
  });

  if (!updated) {
    throw new AdminInitiativeModerationValidationError("Initiative not found.");
  }

  const audit = await record({
    actorParticipantId: admin.memberId,
    action: "initiative.administrative.unblock",
    targetType: "initiative",
    targetId: initiative.initiativeId,
    reason: input.reason?.trim() || undefined,
    beforeSummary: "administrativelyBlocked=true",
    afterSummary: "administrativelyBlocked=false",
  });

  return {
    initiativeId: initiative.initiativeId,
    administrativelyBlocked: false,
    auditId: audit.auditId,
  };
}
