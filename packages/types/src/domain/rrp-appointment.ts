/**
 * HU-RRP-03C — Regional Representative platform designation aggregate.
 *
 * "Appointment" here means an INTERNAL PLATFORM DESIGNATION only.
 * It does NOT confer legal representation authority, power to sign for
 * the Society, employment status, funding entitlement, or admin permissions.
 * Legal appointment is a separate organizational procedure outside this model.
 *
 * Platform designation is granted only by administrator confirm-appointment.
 * Does not change auth.role.
 */

export type RrpAppointmentStatus = "active" | "revoked";

export const RRP_APPOINTMENT_STATUSES: readonly RrpAppointmentStatus[] = [
  "active",
  "revoked",
] as const;

export interface RrpAppointmentAuditEntry {
  readonly at: string;
  readonly byAdminUserId: string;
  readonly action: "appoint" | "revoke";
  readonly note: string | null;
}

/**
 * Durable Mongo-backed Representative platform designation (country-scoped).
 * Unlimited participants may hold active designations for the same country.
 * At most one active designation per (participantId, representCountryCode).
 */
export interface RrpAppointmentRecord {
  readonly appointmentId: string;
  readonly participantId: string;
  readonly userId: string;
  readonly representCountryCode: string;
  readonly sourceApplicationId: string;
  readonly status: RrpAppointmentStatus;
  readonly appointedAt: string;
  readonly appointedByAdminUserId: string;
  readonly revokedAt: string | null;
  readonly revokedByAdminUserId: string | null;
  readonly revision: number;
  readonly auditHistory: readonly RrpAppointmentAuditEntry[];
}

/** Safe admin/participant projection — never includes application PII. */
export interface RrpAppointmentDetail {
  readonly appointmentId: string;
  readonly participantId: string;
  readonly representCountryCode: string;
  readonly sourceApplicationId: string;
  readonly status: RrpAppointmentStatus;
  readonly appointedAt: string;
  readonly revision: number;
}

/**
 * Directory Role-filter classifications derived from applications/appointments.
 * Never stored as auth.role.
 */
export type AdminRrpDirectoryClassification =
  | "applicant_self_funded"
  | "applicant_partial_funding"
  | "applicant_full_funding"
  | "representative";

export const ADMIN_RRP_DIRECTORY_CLASSIFICATIONS: readonly AdminRrpDirectoryClassification[] = [
  "applicant_self_funded",
  "applicant_partial_funding",
  "applicant_full_funding",
  "representative",
] as const;

/** Safe directory row summary — no DOB, funding amounts, or narratives. */
export interface AdminParticipantRrpSummary {
  readonly classifications: readonly AdminRrpDirectoryClassification[];
  readonly activeApplicationIds: readonly string[];
  readonly activeAppointmentIds: readonly string[];
  /**
   * Application ids an administrator may open from the directory
   * (active applicant apps + source apps of active appointments).
   */
  readonly viewableApplicationIds: readonly string[];
  readonly representCountryCodes: readonly string[];
}

/** Result of confirm-appointment (approval + appointment + message intent). */
export interface RrpConfirmAppointmentResult {
  readonly application: import("./rrp-application.js").AdminRrpApplicationDetail;
  readonly appointment: RrpAppointmentDetail;
  /** True when a durable message intent already existed or was newly recorded. */
  readonly messageIntentRecorded: boolean;
  /** Present when best-effort DM delivery did not complete; appointment still stands. */
  readonly messageWarning?: string;
}
