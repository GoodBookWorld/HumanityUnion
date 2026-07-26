export const MEMBERSHIP_TERMS_VERSION = "membership-terms-2026-06-01";

export const MEMBERSHIP_COHORT_PARTICIPANT = "Participant" as const;
export const MEMBERSHIP_COHORT_MEMBER = "Member" as const;

export const MEMBERSHIP_APPLICATION_ACTIVE_STATUSES = ["draft", "submitted", "approved"] as const;

export const MEMBERSHIP_IMMUTABLE_AFTER_GRANT_FIELDS = ["memberNumber", "memberGrantedAt"] as const;
