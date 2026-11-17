/**
 * HU-NOTIF-02C.5 — controlled live SMTP gates.
 * All three must be explicitly true; defaults OFF. Never reads Render secrets here.
 */

import {
  isMemberNotificationEmailDeliveryEnabled,
  resolveMemberNotificationEmailDeliveryMode,
} from "./feature-flag.js";

let liveApprovedOverrideForTests: boolean | null = null;

export function setMemberNotificationEmailLiveApprovedForTests(
  approved: boolean | null,
): void {
  liveApprovedOverrideForTests = approved;
}

/** Exact env "true" only. Default OFF. */
export function isMemberNotificationEmailLiveApproved(): boolean {
  if (liveApprovedOverrideForTests !== null) {
    return liveApprovedOverrideForTests;
  }
  return process.env.HU_MEMBER_NOTIFICATION_EMAIL_LIVE_APPROVED === "true";
}

/**
 * Live provider sends require ENABLED + MODE=live + LIVE_APPROVED.
 * Dry-run does not require LIVE_APPROVED.
 */
export function isMemberNotificationEmailLiveSmtpPermitted(): boolean {
  if (!isMemberNotificationEmailDeliveryEnabled()) {
    return false;
  }
  if (resolveMemberNotificationEmailDeliveryMode() !== "live") {
    return false;
  }
  return isMemberNotificationEmailLiveApproved();
}
