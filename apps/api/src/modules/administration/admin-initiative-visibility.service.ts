import type {
  AdminInitiativeVisibilityCommandResult,
  Initiative,
} from "@hu/types";

import { findAuthUserById } from "../auth/auth-user.repository.js";
import { isInitiativeEligibleForPublicProjection } from "../initiatives/initiative-public-projection.access.js";
import { getInitiativeById, updateInitiative } from "../initiatives/initiative.store.js";
import { invalidateGlobalSearchIndex } from "../global-search/global-search.index.js";
import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
  AdministrationValidationError,
} from "./administration.errors.js";
import { record } from "./audit.service.js";

export class AdminInitiativeCommandValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminInitiativeCommandValidationError";
  }
}

export interface AdminInitiativeVisibilityCommandInput {
  actorUserId: string;
  initiativeId: string;
  reason: string;
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

function requireReason(reason: string): string {
  const trimmed = reason.trim();
  if (trimmed.length < 8) {
    throw new AdministrationValidationError(
      "A reason of at least 8 characters is required for this administrative action.",
    );
  }
  if (trimmed.length > 500) {
    throw new AdministrationValidationError("Reason must be at most 500 characters.");
  }
  return trimmed;
}

function requireProjectedInitiative(initiativeId: string): Initiative {
  const initiative = getInitiativeById(initiativeId);
  if (!initiative) {
    throw new AdminInitiativeCommandValidationError("Initiative not found.");
  }
  if (initiative.lifecyclePhase === "archived") {
    throw new AdminInitiativeCommandValidationError(
      "Archived Initiatives cannot change public visibility through this command.",
    );
  }
  if (initiative.lifecyclePhase !== "projected") {
    throw new AdminInitiativeCommandValidationError(
      "Public visibility moderation applies only to projected Initiatives.",
    );
  }
  return initiative;
}

/**
 * Admin public-visibility hide: sets visibility to steward_only without
 * changing authored content, steward ownership, or lifecycle phase.
 * Projection cards rebuild from eligibility on store update.
 */
export async function hideAdminInitiativeFromPublic(
  input: AdminInitiativeVisibilityCommandInput,
): Promise<AdminInitiativeVisibilityCommandResult> {
  const admin = await assertAdminActor(input.actorUserId);
  const reason = requireReason(input.reason);
  const initiative = requireProjectedInitiative(input.initiativeId);

  if (initiative.visibility.policy !== "public") {
    throw new AdminInitiativeCommandValidationError(
      "Initiative is already hidden from public visibility.",
    );
  }

  const beforeStewardId = initiative.stewardId;
  const beforeTitle = initiative.title;
  const beforeVisibility = initiative.visibility.policy;
  const beforePhase = initiative.lifecyclePhase;

  const updated = updateInitiative(initiative.initiativeId, {
    visibility: { policy: "steward_only" },
  });

  if (!updated) {
    throw new AdminInitiativeCommandValidationError("Initiative not found.");
  }

  if (updated.stewardId !== beforeStewardId || updated.title !== beforeTitle) {
    throw new AdminInitiativeCommandValidationError(
      "Visibility command must not alter ownership or authored title.",
    );
  }

  if (updated.lifecyclePhase !== beforePhase) {
    throw new AdminInitiativeCommandValidationError(
      "Visibility command must not alter lifecycle phase.",
    );
  }

  invalidateGlobalSearchIndex();

  const audit = await record({
    actorParticipantId: admin.memberId,
    action: "initiative.visibility.hide",
    targetType: "initiative",
    targetId: updated.initiativeId,
    scope: { scopeType: "initiative", scopeId: updated.initiativeId },
    reason,
    beforeSummary: `visibility=${beforeVisibility} projected=${String(
      beforeVisibility === "public" && beforePhase === "projected",
    )}`,
    afterSummary: `visibility=${updated.visibility.policy} projected=${String(
      isInitiativeEligibleForPublicProjection(updated),
    )}`,
  });

  return {
    initiativeId: updated.initiativeId,
    visibility: updated.visibility.policy,
    publiclyProjected: isInitiativeEligibleForPublicProjection(updated),
    auditId: audit.auditId,
  };
}

/**
 * Restore public visibility for a projected Initiative previously hidden
 * via steward_only without changing authored content or ownership.
 */
export async function restoreAdminInitiativePublicVisibility(
  input: AdminInitiativeVisibilityCommandInput,
): Promise<AdminInitiativeVisibilityCommandResult> {
  const admin = await assertAdminActor(input.actorUserId);
  const reason = requireReason(input.reason);
  const initiative = requireProjectedInitiative(input.initiativeId);

  if (initiative.visibility.policy !== "steward_only") {
    throw new AdminInitiativeCommandValidationError(
      "Initiative is already publicly visible (or not steward_only).",
    );
  }

  const beforeStewardId = initiative.stewardId;
  const beforeTitle = initiative.title;
  const beforeVisibility = initiative.visibility.policy;
  const beforePhase = initiative.lifecyclePhase;

  const updated = updateInitiative(initiative.initiativeId, {
    visibility: { policy: "public" },
  });

  if (!updated) {
    throw new AdminInitiativeCommandValidationError("Initiative not found.");
  }

  if (updated.stewardId !== beforeStewardId || updated.title !== beforeTitle) {
    throw new AdminInitiativeCommandValidationError(
      "Visibility command must not alter ownership or authored title.",
    );
  }

  if (updated.lifecyclePhase !== beforePhase) {
    throw new AdminInitiativeCommandValidationError(
      "Visibility command must not alter lifecycle phase.",
    );
  }

  invalidateGlobalSearchIndex();

  const audit = await record({
    actorParticipantId: admin.memberId,
    action: "initiative.visibility.restore",
    targetType: "initiative",
    targetId: updated.initiativeId,
    scope: { scopeType: "initiative", scopeId: updated.initiativeId },
    reason,
    beforeSummary: `visibility=${beforeVisibility}`,
    afterSummary: `visibility=${updated.visibility.policy} projected=${String(
      isInitiativeEligibleForPublicProjection(updated),
    )}`,
  });

  return {
    initiativeId: updated.initiativeId,
    visibility: updated.visibility.policy,
    publiclyProjected: isInitiativeEligibleForPublicProjection(updated),
    auditId: audit.auditId,
  };
}
