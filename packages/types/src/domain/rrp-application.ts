/**
 * HU-RRP-02B / 03C — Regional Representative Program application aggregate.
 * Representative appointment is granted only via administrator
 * confirm-appointment (approval + appointment as one operation).
 * Never grants administrator privileges. Funding requests are not commitments.
 */

export type RrpApplicationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "information_requested"
  | "approved"
  | "rejected"
  | "withdrawn";

export const RRP_APPLICATION_STATUSES: readonly RrpApplicationStatus[] = [
  "draft",
  "submitted",
  "under_review",
  "information_requested",
  "approved",
  "rejected",
  "withdrawn",
] as const;

/** Statuses that block a second application for the same representation country. */
export const RRP_APPLICATION_ACTIVE_STATUSES: readonly RrpApplicationStatus[] = [
  "draft",
  "submitted",
  "under_review",
  "information_requested",
] as const;

export const RRP_APPLICATION_TERMINAL_STATUSES: readonly RrpApplicationStatus[] = [
  "approved",
  "rejected",
  "withdrawn",
] as const;

export type RrpFundingModel = "SELF" | "PARTIAL" | "FULL";

export const RRP_FUNDING_MODELS: readonly RrpFundingModel[] = ["SELF", "PARTIAL", "FULL"] as const;

/**
 * Current consent document version accepted at submission.
 * Bumped to v2 for the RRP application disclosure (source prepared in HU-RRP-03F.1).
 * HU-PRIVACY-02B publishes English Privacy as privacy-2026-11-v1; consent remains
 * rrp-application-consent-v2 (no automatic re-consent of historical rows).
 * Previously submitted applications retain their stored consentVersion / consentAcceptedAt.
 */
export const RRP_APPLICATION_CONSENT_VERSION = "rrp-application-consent-v2" as const;

export type RrpApplicationDecisionActorRole = "participant" | "admin";

export interface RrpApplicationDecisionHistoryEntry {
  readonly fromStatus: RrpApplicationStatus;
  readonly toStatus: RrpApplicationStatus;
  readonly at: string;
  readonly byUserId: string;
  readonly byRole: RrpApplicationDecisionActorRole;
  readonly note: string | null;
}

/**
 * Private Mongo-backed RRP application record.
 * HU-RRP-04B — initial submission is a voluntary expression of interest.
 * Legal names, DOB, funding, and most profile fields are optional.
 * DOB and other applicant PII must never appear in public projections, audit
 * titles, logs, or analytics events. Display/pseudonym identity lives on the
 * participant profile — never auto-copied into legal name fields.
 */
export interface RrpApplicationRecord {
  readonly applicationId: string;
  readonly participantId: string;
  readonly userId: string;
  /** Optional; private to authorized review. Not required for submission. */
  readonly legalFirstName: string | null;
  /** Optional; private to authorized review. Not required for submission. */
  readonly legalLastName: string | null;
  readonly profession: string | null;
  readonly residenceCountryCode: string | null;
  readonly representCountryCode: string;
  /** Optional calendar date YYYY-MM-DD only — never logged or published. No age gate. */
  readonly dateOfBirth: string | null;
  readonly fundingModel: RrpFundingModel | null;
  /** Annual CAD request; required for PARTIAL/FULL when model set; null for SELF or unspecified. Not an approved commitment. */
  readonly annualRequestedAmountCad: number | null;
  readonly teamMemberCount: number | null;
  readonly relevantExperience: string | null;
  readonly motivation: string | null;
  readonly consentAcceptedAt: string | null;
  readonly consentVersion: string | null;
  readonly status: RrpApplicationStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly submittedAt: string | null;
  readonly reviewedAt: string | null;
  readonly reviewerAdminUserId: string | null;
  readonly revision: number;
  readonly decisionHistory: readonly RrpApplicationDecisionHistoryEntry[];
}

/** Owner-authenticated detail (includes DOB for the applicant only). */
export interface RrpApplicationDetail {
  readonly applicationId: string;
  readonly participantId: string;
  readonly legalFirstName: string | null;
  readonly legalLastName: string | null;
  readonly profession: string | null;
  readonly residenceCountryCode: string | null;
  readonly representCountryCode: string;
  readonly dateOfBirth: string | null;
  readonly fundingModel: RrpFundingModel | null;
  readonly annualRequestedAmountCad: number | null;
  readonly teamMemberCount: number | null;
  readonly relevantExperience: string | null;
  readonly motivation: string | null;
  readonly consentAcceptedAt: string | null;
  readonly consentVersion: string | null;
  readonly status: RrpApplicationStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly submittedAt: string | null;
  readonly reviewedAt: string | null;
  readonly revision: number;
  readonly decisionHistory: readonly RrpApplicationDecisionHistoryEntry[];
  /**
   * True when an active platform Representative designation exists for this
   * application’s country (internal designation only — not legal authority).
   */
  readonly platformDesignationActive?: boolean;
  /**
   * Owner-safe deep-link into an existing admin DM for this application.
   * Server-derived only; never client-constructed. Null when unavailable.
   */
  readonly adminConversationId?: string | null;
  /**
   * Why a conversation id is or is not available (owner-safe; no admin PII).
   */
  readonly adminConversationAvailability?: RrpAdminConversationAvailability;
}

/**
 * Owner-facing availability of an existing RRP administrative DM.
 * Does not imply permission to start a new conversation.
 */
export type RrpAdminConversationAvailability =
  | "available"
  | "pending"
  | "failed"
  | "none"
  | "unavailable";

/** Owner-only resolver result for Open Messages deep-link. */
export interface RrpAdminConversationResolution {
  readonly applicationId: string;
  readonly conversationId: string | null;
  readonly availability: RrpAdminConversationAvailability;
}
/** Admin list row — no date of birth. */
export interface AdminRrpApplicationListItem {
  readonly applicationId: string;
  readonly participantId: string;
  readonly userId: string;
  readonly legalFirstName: string | null;
  readonly legalLastName: string | null;
  readonly profession: string | null;
  readonly residenceCountryCode: string | null;
  readonly representCountryCode: string;
  readonly fundingModel: RrpFundingModel | null;
  readonly annualRequestedAmountCad: number | null;
  readonly teamMemberCount: number | null;
  readonly status: RrpApplicationStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly submittedAt: string | null;
  readonly reviewedAt: string | null;
  readonly revision: number;
}

/** Admin detail — DOB visible only here; never in notifications or audit titles. */
export interface AdminRrpApplicationDetail extends AdminRrpApplicationListItem {
  readonly dateOfBirth: string | null;
  readonly relevantExperience: string | null;
  readonly motivation: string | null;
  readonly consentAcceptedAt: string | null;
  readonly consentVersion: string | null;
  readonly reviewerAdminUserId: string | null;
  readonly decisionHistory: readonly RrpApplicationDecisionHistoryEntry[];
}

/**
 * Admin review API decisions (POST …/review).
 * Status-only `"approve"` was removed — approval requires confirm-appointment.
 */
export type AdminRrpApplicationReviewDecision =
  | "mark_under_review"
  | "request_information"
  | "reject";

/**
 * Internal confirm-appointment approval transition only.
 * Not accepted by the review API.
 */
export type AdminRrpConfirmAppointmentDecision = "approve";

/** Admin review result — optional Messages delivery warning for request_information. */
export interface AdminRrpApplicationReviewResult {
  readonly application: AdminRrpApplicationDetail;
  readonly messageIntentRecorded?: boolean;
  readonly messageWarning?: string;
}
