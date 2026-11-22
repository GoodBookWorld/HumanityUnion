import type { MemberNotification } from "@hu/types";

/** Approved published Privacy Policy. Not a civic entity id. */
export const PRIVACY_POLICY_NOTICE_VERSION = "privacy-2026-11-v2" as const;

export const PRIVACY_POLICY_NOTICE_PATH = "/privacy" as const;

export const PRIVACY_POLICY_NOTICE_PUBLIC_URL = "https://huws.org/privacy" as const;

export const PRIVACY_POLICY_NOTICE_ENTITY = "legal_policy" as const;

export const PRIVACY_POLICY_NOTICE_TITLE = "Privacy Policy Updated";

export const PRIVACY_POLICY_NOTICE_MESSAGE = [
  "Humanity Union has updated its Privacy Policy, effective November 22, 2026.",
  "The update explains account deletion and recovery, the 30-day recovery period, and retention of civic records and private messages.",
  "Account deletion is not yet available.",
].join(" ");

/** Text that the live English page must show before any notice is stored. */
export const PRIVACY_POLICY_NOTICE_EFFECTIVE_TEXT = "Effective Date: November 22, 2026";

/** Wording added by Privacy Policy v2. Version 1 does not contain it. */
export const PRIVACY_POLICY_NOTICE_PUBLIC_MARKER =
  "The period runs for 720 hours from confirmation.";

export const PRIVACY_POLICY_NOTICE_PREVIOUS_EFFECTIVE_TEXT = "Effective Date: November 18, 2026";

export const PRIVACY_POLICY_NOTICE_BATCH_DEFAULT = 50;
export const PRIVACY_POLICY_NOTICE_BATCH_MAX = 100;

export function isPrivacyPolicyNoticeRow(
  notification: Pick<
    MemberNotification,
    "eventType" | "relatedEntityType" | "relatedEntityId" | "relatedUrl"
  >,
): boolean {
  return (
    notification.eventType === "privacy_policy_updated" &&
    notification.relatedEntityType === PRIVACY_POLICY_NOTICE_ENTITY &&
    notification.relatedEntityId === PRIVACY_POLICY_NOTICE_VERSION &&
    notification.relatedUrl === PRIVACY_POLICY_NOTICE_PATH
  );
}
