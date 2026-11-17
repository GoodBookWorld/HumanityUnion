/**
 * HU-NOTIF-02C.5 — controlled live recipient allowlist.
 * Uses stable participant/member IDs only — never plaintext emails in env or logs.
 * Empty allowlist → no live notification email delivery.
 */

let allowlistOverrideForTests: ReadonlySet<string> | null = null;

function normalizeMemberId(value: string): string {
  return value.trim();
}

/**
 * Env: HU_MEMBER_NOTIFICATION_EMAIL_LIVE_RECIPIENT_MEMBER_IDS
 * Comma-separated member/participant IDs. Empty → deny all live sends.
 */
export function resolveMemberNotificationEmailLiveRecipientAllowlist(): ReadonlySet<string> {
  if (allowlistOverrideForTests) {
    return allowlistOverrideForTests;
  }
  const raw = process.env.HU_MEMBER_NOTIFICATION_EMAIL_LIVE_RECIPIENT_MEMBER_IDS?.trim() ?? "";
  if (!raw) {
    return new Set();
  }
  const ids = raw
    .split(",")
    .map(normalizeMemberId)
    .filter((entry) => entry.length > 0);
  return new Set(ids);
}

export function setMemberNotificationEmailLiveRecipientAllowlistForTests(
  memberIds: readonly string[] | null,
): void {
  allowlistOverrideForTests =
    memberIds === null ? null : new Set(memberIds.map(normalizeMemberId).filter(Boolean));
}

export function isMemberNotificationEmailLiveRecipientAllowlisted(
  recipientMemberId: string | null | undefined,
): boolean {
  if (!recipientMemberId || !recipientMemberId.trim()) {
    return false;
  }
  const allowlist = resolveMemberNotificationEmailLiveRecipientAllowlist();
  if (allowlist.size === 0) {
    return false;
  }
  return allowlist.has(normalizeMemberId(recipientMemberId));
}
