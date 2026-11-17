import {
  RRP_APPLICATION_ACTIVE_STATUSES,
  RRP_APPLICATION_CONSENT_VERSION,
} from "@hu/types";

export {
  RRP_APPLICATION_ACTIVE_STATUSES,
  RRP_APPLICATION_CONSENT_VERSION,
  RRP_APPLICATION_STATUSES,
  RRP_APPLICATION_TERMINAL_STATUSES,
  RRP_FUNDING_MODELS,
} from "@hu/types";

/** Bounded string lengths for applicant-supplied text. */
export const RRP_LEGAL_NAME_MAX_LENGTH = 100;
export const RRP_PROFESSION_MAX_LENGTH = 200;
export const RRP_EXPERIENCE_MAX_LENGTH = 5_000;
export const RRP_MOTIVATION_MAX_LENGTH = 5_000;
export const RRP_REVIEW_NOTE_MAX_LENGTH = 2_000;

/** Team size inclusive bounds. */
export const RRP_TEAM_MEMBER_COUNT_MIN = 0;
export const RRP_TEAM_MEMBER_COUNT_MAX = 500;

/**
 * Annual CAD request bounds for PARTIAL/FULL.
 * Requested funding is not an approved financial commitment.
 */
export const RRP_ANNUAL_AMOUNT_CAD_MIN = 1;
export const RRP_ANNUAL_AMOUNT_CAD_MAX = 1_000_000;

export const RRP_ADMIN_LIST_DEFAULT_LIMIT = 25;
export const RRP_ADMIN_LIST_MAX_LIMIT = 100;

export const RRP_ACTIVE_STATUS_SET = new Set<string>(RRP_APPLICATION_ACTIVE_STATUSES);

export const RRP_CURRENT_CONSENT_VERSION = RRP_APPLICATION_CONSENT_VERSION;

/**
 * Partial unique index enforcing one ACTIVE application per
 * (participantId, representCountryCode). Must exist before writes.
 */
export const RRP_ACTIVE_UNIQUE_INDEX_NAME =
  "rrp_application_one_active_per_participant_country" as const;

export const RRP_ACTIVE_UNIQUE_INDEX_KEYS = {
  participantId: 1,
  representCountryCode: 1,
} as const;
