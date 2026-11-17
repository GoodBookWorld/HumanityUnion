/**
 * HU-NOTIF-02C.1 / 02C.2 — member notification email delivery flags.
 * ENABLED default OFF (exact "true" only).
 * MODE default off. Supported: off | dry_run | live. Never auto-enable live.
 */

import type { MemberNotificationEmailDeliveryMode } from "@hu/types";

let enabledOverrideForTests: boolean | null = null;
let modeOverrideForTests: MemberNotificationEmailDeliveryMode | null = null;

export function setMemberNotificationEmailDeliveryEnabledForTests(
  enabled: boolean | null,
): void {
  enabledOverrideForTests = enabled;
}

export function setMemberNotificationEmailDeliveryModeForTests(
  mode: MemberNotificationEmailDeliveryMode | null,
): void {
  modeOverrideForTests = mode;
}

export function isMemberNotificationEmailDeliveryEnabled(): boolean {
  if (enabledOverrideForTests !== null) {
    return enabledOverrideForTests;
  }
  return process.env.HU_MEMBER_NOTIFICATION_EMAIL_DELIVERY_ENABLED === "true";
}

export function resolveMemberNotificationEmailDeliveryMode(): MemberNotificationEmailDeliveryMode {
  if (modeOverrideForTests !== null) {
    return modeOverrideForTests;
  }
  const raw = process.env.HU_MEMBER_NOTIFICATION_EMAIL_DELIVERY_MODE?.trim().toLowerCase();
  if (raw === "dry_run" || raw === "live" || raw === "off") {
    return raw;
  }
  return "off";
}

/** Worker may process only when ENABLED and mode is dry_run or live. */
export function isMemberNotificationEmailDeliveryWorkerPermitted(): boolean {
  if (!isMemberNotificationEmailDeliveryEnabled()) {
    return false;
  }
  const mode = resolveMemberNotificationEmailDeliveryMode();
  return mode === "dry_run" || mode === "live";
}

/**
 * Explicit activation boundary for bounded processing/recovery.
 * When unset, worker processing is fail-closed (no historical scan).
 */
export function resolveMemberNotificationEmailDeliveryActivationAt(): string | null {
  const raw = process.env.HU_MEMBER_NOTIFICATION_EMAIL_DELIVERY_ACTIVATION_AT?.trim();
  if (!raw) {
    return null;
  }
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return new Date(parsed).toISOString();
}
