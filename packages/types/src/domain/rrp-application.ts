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
 * Bumped to v2 with HU-RRP-03F.1 Privacy RRP disclosure (canonical privacy-2026-11-v1).
 * Previously submitted applications retain their stored consentVersion / consentAcceptedAt;
 * there is no automatic re-consent migration of historical rows.
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
 * DOB and other applicant PII must never appear in public projections, audit
 * titles, logs, or analytics events.
 */
export interface RrpApplicationRecord {
  readonly applicationId: string;
  readonly participantId: string;
  readonly userId: string;
  readonly legalFirstName: string | null;
  readonly legalLastName: string | null;
  readonly profession: string | null;
  readonly residenceCountryCode: string | null;
  readonly representCountryCode: string;
  /** Calendar date YYYY-MM-DD only — never logged or published. */
  readonly dateOfBirth: string | null;
  readonly fundingModel: RrpFundingModel | null;
  /** Annual CAD request; required for PARTIAL/FULL, null for SELF. Not an approved commitment. */
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
