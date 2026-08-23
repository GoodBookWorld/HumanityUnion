/**
 * Pack 12C — Fix08 Admin initiative/election soft-block with ADMIN provenance.
 * Admin may upgrade an EDITOR block to ADMIN (reblock).
 */
import type { AdminInitiativeBlockCommandResult, Initiative } from "@hu/types";
import { resolveEffectiveModerationBlock } from "@hu/types";

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
 * Fix 08C / Pack 12C — Admin soft-block (authority=ADMIN).
 * If already EDITOR-blocked, upgrades effective authority to ADMIN.
 * Does not change visibility.policy, closedAt, retention, or lifecycle phase.
 */
export async function blockAdminInitiative(
  input: AdminInitiativeBlockCommandInput,
): Promise<AdminInitiativeBlockCommandResult> {
  const admin = await assertAdminActor(input.actorUserId);
  const initiative = requireInitiative(input.initiativeId);
  const existing = resolveEffectiveModerationBlock(initiative);

  if (existing.isBlocked && existing.authority === "ADMIN") {
    throw new AdminInitiativeModerationValidationError("Initiative is already blocked.");
  }

  const reason = input.reason?.trim() || undefined;
  if (reason && reason.length > 500) {
    throw new AdministrationValidationError("Reason must be at most 500 characters.");
  }

  const now = new Date().toISOString();
  const updated = updateInitiative(initiative.initiativeId, {
    administrativelyBlocked: true,
    administrativeBlockAuthority: "ADMIN",
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
    beforeSummary: existing.isBlocked
      ? `administrativelyBlocked=true;authority=${existing.authority}`
      : "administrativelyBlocked=false",
    afterSummary: "administrativelyBlocked=true;authority=ADMIN",
  });

  return {
    initiativeId: initiative.initiativeId,
    administrativelyBlocked: true,
    auditId: audit.auditId,
  };
}

/**
 * Fix 08C / Pack 12C — Admin may clear ADMIN or EDITOR soft-blocks.
 * Does not reopen CLOSED Public Choice elections.
 */
export async function unblockAdminInitiative(
  input: AdminInitiativeBlockCommandInput,
): Promise<AdminInitiativeBlockCommandResult> {
  const admin = await assertAdminActor(input.actorUserId);
  const initiative = requireInitiative(input.initiativeId);
  const existing = resolveEffectiveModerationBlock(initiative);

  if (!existing.isBlocked) {
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
    beforeSummary: `administrativelyBlocked=true;authority=${existing.authority}`,
    afterSummary: "administrativelyBlocked=false",
  });

  return {
    initiativeId: initiative.initiativeId,
    administrativelyBlocked: false,
    auditId: audit.auditId,
  };
}
