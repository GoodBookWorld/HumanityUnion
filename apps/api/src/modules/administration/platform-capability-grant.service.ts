import { randomUUID } from "node:crypto";

import type {
  AuthRole,
  CapabilityScopeType,
  PlatformCapabilityGrant,
  PlatformCapabilityGrantSource,
  PlatformCapabilityId,
} from "@hu/types";
import { PLATFORM_CAPABILITY_IDS } from "@hu/types";

import { AdministrationValidationError } from "./administration.errors.js";
import { AuditService } from "./audit.service.js";
import { assertCapability } from "./capability-resolver.js";
import {
  insertPlatformCapabilityGrant,
  replacePlatformCapabilityGrant,
} from "./persistence/platform-capability-grant.repository.js";

function isPlatformCapabilityId(value: string): value is PlatformCapabilityId {
  return (PLATFORM_CAPABILITY_IDS as readonly string[]).includes(value);
}

/**
 * Foundation write path for generalized grants (dual-read with Blog grants).
 * Does not migrate or replace blog_capability_grants.
 */
export async function grantPlatformCapability(input: {
  actorParticipantId: string;
  role?: AuthRole;
  targetParticipantId: string;
  capability: PlatformCapabilityId;
  scopeType?: CapabilityScopeType;
  scopeId?: string;
  reason?: string;
  source?: PlatformCapabilityGrantSource;
  expiresAt?: string;
}): Promise<PlatformCapabilityGrant> {
  if (!isPlatformCapabilityId(input.capability)) {
    throw new AdministrationValidationError("Unknown capability.");
  }

  await assertCapability({
    participantId: input.actorParticipantId,
    role: input.role,
    capability: "platform.capability.manage",
  });

  // High-impact: only Administrators may grant platform.admin (same actor must already hold it).
  if (input.capability === "platform.admin") {
    await assertCapability({
      participantId: input.actorParticipantId,
      role: input.role,
      capability: "platform.admin",
    });
    if (!input.reason?.trim()) {
      throw new AdministrationValidationError(
        "Reason is required when granting Administrator.",
      );
    }
  }

  const now = new Date().toISOString();
  const grant: PlatformCapabilityGrant = {
    grantId: `plat-grant-${randomUUID()}`,
    participantId: input.targetParticipantId.trim(),
    capability: input.capability,
    scopeType: input.scopeType ?? "global",
    scopeId: input.scopeId,
    grantedByParticipantId: input.actorParticipantId,
    grantedAt: now,
    expiresAt: input.expiresAt,
    reason: input.reason?.trim() || undefined,
    source: input.source ?? "admin_console",
  };

  await insertPlatformCapabilityGrant(grant);
  await AuditService.record({
    actorParticipantId: input.actorParticipantId,
    action: "capability.grant",
    targetType: "platform_capability_grant",
    targetId: grant.grantId,
    scope: { scopeType: grant.scopeType, scopeId: grant.scopeId },
    reason: grant.reason,
    afterSummary: `${grant.capability} → ${grant.participantId}`,
  });

  return grant;
}

export async function revokePlatformCapability(input: {
  actorParticipantId: string;
  role?: AuthRole;
  grant: PlatformCapabilityGrant;
  reason: string;
}): Promise<PlatformCapabilityGrant> {
  await assertCapability({
    participantId: input.actorParticipantId,
    role: input.role,
    capability: "platform.capability.manage",
  });

  if (!input.reason.trim()) {
    throw new AdministrationValidationError("Reason is required to revoke a capability.");
  }

  if (input.grant.revokedAt) {
    return input.grant;
  }

  const now = new Date().toISOString();
  const revoked: PlatformCapabilityGrant = {
    ...input.grant,
    revokedAt: now,
    revokedByParticipantId: input.actorParticipantId,
    reason: input.reason.trim(),
  };

  await replacePlatformCapabilityGrant(revoked);
  await AuditService.record({
    actorParticipantId: input.actorParticipantId,
    action: "capability.revoke",
    targetType: "platform_capability_grant",
    targetId: revoked.grantId,
    scope: { scopeType: revoked.scopeType, scopeId: revoked.scopeId },
    reason: revoked.reason,
    beforeSummary: `${revoked.capability} active for ${revoked.participantId}`,
    afterSummary: "revoked",
  });

  return revoked;
}
