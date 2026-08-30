import { APPROVED_PRODUCTION_ADMIN } from "../production-admin-bootstrap/constants.js";
import { APPROVED_PRODUCTION_STEWARDS } from "../production-steward-bootstrap/constants.js";
import { APPROVED_PRODUCTION_PARTICIPANTS } from "../production-initiative-migration/constants.js";
import { PRODUCTION_AUTH_ACTIVATION_USER_IDS_ENV } from "./constants.js";

export type ActivationAllowlistEntry = {
  userId: string;
  label: string;
  source: "admin_bootstrap" | "steward_bootstrap" | "initiative_participants" | "env_extra";
  expectedAuthRole: "admin" | "member";
};

/**
 * Canonical production activation targets by userId only (no emails).
 */
export function resolveProductionAuthActivationAllowlist(
  env: NodeJS.ProcessEnv = process.env,
): ActivationAllowlistEntry[] {
  const byUserId = new Map<string, ActivationAllowlistEntry>();

  byUserId.set(APPROVED_PRODUCTION_ADMIN.userId, {
    userId: APPROVED_PRODUCTION_ADMIN.userId,
    label: APPROVED_PRODUCTION_ADMIN.label,
    source: "admin_bootstrap",
    expectedAuthRole: "admin",
  });

  for (const steward of APPROVED_PRODUCTION_STEWARDS) {
    byUserId.set(steward.userId, {
      userId: steward.userId,
      label: steward.label,
      source: "steward_bootstrap",
      expectedAuthRole: "member",
    });
  }

  for (const participant of APPROVED_PRODUCTION_PARTICIPANTS) {
    if (byUserId.has(participant.userId)) continue;
    byUserId.set(participant.userId, {
      userId: participant.userId,
      label: participant.label,
      source: "initiative_participants",
      expectedAuthRole: participant.authRole,
    });
  }

  const extras = (env[PRODUCTION_AUTH_ACTIVATION_USER_IDS_ENV] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  for (const userId of extras) {
    if (byUserId.has(userId)) continue;
    byUserId.set(userId, {
      userId,
      label: `extra-${userId.slice(0, 8)}`,
      source: "env_extra",
      expectedAuthRole: "member",
    });
  }

  return [...byUserId.values()].sort((a, b) => a.userId.localeCompare(b.userId));
}
