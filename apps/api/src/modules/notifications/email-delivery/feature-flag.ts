/**
 * HU-NOTIF-02C.1 — member notification email delivery feature flag.
 * Default OFF. Only exact "true" enables. No environment enables it by default.
 */

let enabledOverrideForTests: boolean | null = null;

export function setMemberNotificationEmailDeliveryEnabledForTests(
  enabled: boolean | null,
): void {
  enabledOverrideForTests = enabled;
}

export function isMemberNotificationEmailDeliveryEnabled(): boolean {
  if (enabledOverrideForTests !== null) {
    return enabledOverrideForTests;
  }
  return process.env.HU_MEMBER_NOTIFICATION_EMAIL_DELIVERY_ENABLED === "true";
}

/**
 * Explicit activation boundary for bounded gap recovery.
 * Only notifications at/after this ISO timestamp are eligible for recovery.
 * When unset, recovery remains disabled (fail closed for historical scan).
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
