import { createHash } from "node:crypto";

import type { AccountDeletionRecord } from "../auth/auth-user.types.js";

/** Approved recovery window. Deadline is this many milliseconds after confirmation. */
export const ACCOUNT_DELETION_RECOVERY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** One reminder when the remaining recovery time is three days or less. */
export const ACCOUNT_DELETION_REMINDER_LEAD_MS = 3 * 24 * 60 * 60 * 1000;

/** Published Privacy Policy contact. The reminder names this address. */
export const ACCOUNT_DELETION_SUPPORT_EMAIL = "info@huws.org";

export function isDeletionReminderDue(deadlineAt: string, nowIso: string): boolean {
  const deadline = Date.parse(deadlineAt);
  const now = Date.parse(nowIso);
  if (Number.isNaN(deadline) || Number.isNaN(now)) {
    return false;
  }
  const remaining = deadline - now;
  return remaining > 0 && remaining <= ACCOUNT_DELETION_REMINDER_LEAD_MS;
}

/** Non-deliverable domain. Registration rejects it so a tombstone cannot be used as a mailbox. */
export const RESERVED_DELETION_EMAIL_DOMAIN = "accounts.invalid";

/**
 * A crashed finalization notice claim can be finished without a second message
 * after this delay. The scheduled notice already told the participant the deadline.
 */
export const ACCOUNT_DELETION_NOTICE_RECLAIM_MS = 5 * 60 * 1000;

/**
 * Civic byline retention, isolated for policy review.
 *
 * Public civic projections read `member.profile.displayName` live. Civic
 * documents are not rewritten. Keeping that field preserves historical
 * attribution. This is not a determination that the name is exempt from a
 * privacy deletion request.
 */
export const CIVIC_DISPLAY_NAME_RETENTION =
  "retain-live-profile-display-name-pending-policy-review" as const;

export const ACCOUNT_DELETION_CANCEL_REQUEST_MESSAGE =
  "If a deletion is pending for that account, a cancellation code has been sent.";

export const ACCOUNT_DELETION_CANCEL_FAILURE_MESSAGE =
  "The cancellation could not be completed.";

export const ACCOUNT_DELETION_CANCEL_SUCCESS_MESSAGE =
  "Your account deletion has been cancelled. You can sign in again.";

export function reservedDeletionEmail(userId: string): string {
  return `deleted.${userId}@${RESERVED_DELETION_EMAIL_DOMAIN}`;
}

export function isReservedDeletionEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${RESERVED_DELETION_EMAIL_DOMAIN}`);
}

export function hashDeletionEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

export function deletionDeadlineFromConfirmation(confirmedAtIso: string): string {
  const confirmedAt = Date.parse(confirmedAtIso);
  if (Number.isNaN(confirmedAt)) {
    throw new Error("Confirmation time is invalid.");
  }
  return new Date(confirmedAt + ACCOUNT_DELETION_RECOVERY_WINDOW_MS).toISOString();
}

/** Pending and finalized accounts cannot sign in or keep using a session. */
export function isAccountDeletionSignInBlocked(
  deletion: AccountDeletionRecord | undefined,
): boolean {
  return deletion?.phase === "pending" || deletion?.phase === "finalized";
}

export function isDeletionRecoveryOpen(deletion: AccountDeletionRecord, nowIso: string): boolean {
  if (deletion.phase !== "pending" || !deletion.deadlineAt) {
    return false;
  }
  return deletion.deadlineAt > nowIso;
}

/** Idempotent confirm must stay reachable after the account is pending. */
export function isAccountDeletionConfirmPath(path: string): boolean {
  return path === "/confirm" || path.endsWith("/account/deletion/confirm");
}
