/**
 * Pack 23E.1 — Beta invite Admin UI labels and status chips.
 */
import type { BetaInviteStatus } from "@hu/types";

export function formatBetaInviteStatusLabel(status: BetaInviteStatus): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "used":
      return "Used";
    case "expired":
      return "Expired";
    case "revoked":
      return "Revoked";
    default:
      return status;
  }
}

/** Reuses Admin publishing status-chip semantics (success / warning / muted). */
export function betaInviteStatusClassName(status: BetaInviteStatus): string {
  switch (status) {
    case "used":
      return "admin-publishing-table__status admin-publishing-table__status--active";
    case "pending":
      return "admin-publishing-table__status admin-publishing-table__status--pending";
    case "expired":
    case "revoked":
      return "admin-publishing-table__status admin-publishing-table__status--blocked";
    default:
      return "admin-publishing-table__status";
  }
}

export function canRevokeBetaInvite(status: BetaInviteStatus): boolean {
  return status === "pending";
}

export function countBetaInvitesByStatus(
  invites: readonly { status: BetaInviteStatus }[],
): Record<BetaInviteStatus, number> {
  const counts: Record<BetaInviteStatus, number> = {
    pending: 0,
    used: 0,
    expired: 0,
    revoked: 0,
  };
  for (const invite of invites) {
    counts[invite.status] = (counts[invite.status] ?? 0) + 1;
  }
  return counts;
}
