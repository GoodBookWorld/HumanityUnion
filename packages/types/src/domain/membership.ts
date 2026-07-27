/** Humanity Union Membership lifecycle status (TASK-090). */
export type MembershipStatus =
  | "not_started"
  | "application_started"
  | "application_completed"
  | "pending_payment"
  | "manual_review"
  | "active_member"
  | "payment_refunded"
  | "payment_disputed"
  | "technical_error";

/** Application workflow status — separate from payment (TASK-090). */
export type MembershipApplicationStatus =
  "not_started" | "draft" | "submitted" | "approved" | "cancelled";

/** Mongo-backed Membership record (1:1 with auth user). */
export interface MembershipRecord {
  membershipId: string;
  userId: string;
  profileId: string;
  memberNumber: string | null;
  status: MembershipStatus;
  applicationStatus: MembershipApplicationStatus;
  countryCode: string | null;
  participationCountryCodes: string[] | null;
  displayNameConfirmed: string | null;
  termsVersion: string | null;
  termsAcceptedAt: string | null;
  applicationSubmittedAt: string | null;
  memberGrantedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Public-safe membership summary for profile and workspace UI. */
export interface MembershipSummary {
  cohortLabel: "Participant" | "Member";
  status: MembershipStatus;
  applicationStatus: MembershipApplicationStatus;
  memberNumber: string | null;
  memberSince: string | null;
  countryCode: string | null;
  participationCountryCodes: string[] | null;
}

/** Application fields exposed to the authenticated participant. */
export interface MembershipApplicationView {
  countryCode: string | null;
  participationCountryCodes: string[] | null;
  displayNameConfirmed: string | null;
  termsVersion: string | null;
  termsAcceptedAt: string | null;
  applicationSubmittedAt: string | null;
}

/** Timeline step for Membership workspace widget. */
export interface MembershipTimelineStep {
  id: "registration" | "email_confirmed" | "application" | "contribution" | "member";
  label: string;
  state: "complete" | "current" | "upcoming";
  detail?: string;
}

/** GET /api/v1/membership/me response payload. */
export interface MembershipMePayload {
  membership: MembershipSummary;
  application: MembershipApplicationView;
  timeline: MembershipTimelineStep[];
  emailConfirmed: boolean;
}

/** GET /api/v1/membership/status lightweight payload. */
export interface MembershipStatusPayload {
  cohortLabel: "Participant" | "Member";
  status: MembershipStatus;
  applicationStatus: MembershipApplicationStatus;
  memberNumber: string | null;
}

/** POST/PATCH membership application body. */
export interface MembershipApplicationInput {
  participationCountryCodes?: string[];
  /** @deprecated Legacy single-country field — migrated to participationCountryCodes. */
  countryCode?: string;
  displayNameConfirmed: string;
  understandMembershipMeaning: boolean;
  understandNoVoteWeightChange: boolean;
  understandDataPolicy: boolean;
  submit?: boolean;
}
