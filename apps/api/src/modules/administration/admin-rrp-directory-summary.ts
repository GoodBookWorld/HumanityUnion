/**
 * HU-RRP-06B — pure Admin directory RRP summary + attention derivation.
 * Kept free of Mongo/auth imports so unit tests can exercise it in isolation.
 */

import type {
  AdminParticipantRrpSummary,
  AdminRrpDirectoryClassification,
  RrpApplicationRecord,
  RrpApplicationStatus,
  RrpAppointmentRecord,
} from "@hu/types";

/**
 * Applicant pipeline statuses that appear in directory classification.
 * Must stay aligned with `RRP_APPLICANT_DIRECTORY_STATUSES` in
 * `rrp-application.repository.ts`.
 */
export const RRP_DIRECTORY_PIPELINE_STATUSES: readonly RrpApplicationStatus[] = [
  "submitted",
  "under_review",
  "information_requested",
];

/**
 * Durable attention derivation for one application.
 *
 * Lifecycle events used:
 * - Participant submit/resubmit sets `submittedAt` and status `submitted`
 *   (including replies after `information_requested`).
 * - First successful admin action (`mark_under_review`, `request_information`,
 *   `reject`, or confirm-appointment approve) sets `reviewedAt`.
 * - Opening/viewing an application does not mutate these fields.
 *
 * Attention is true only for applicant-pipeline statuses when the latest
 * submit is strictly newer than the latest admin review, or never reviewed.
 */
export function deriveRrpApplicationNeedsAdminAttention(
  application: Pick<RrpApplicationRecord, "status" | "submittedAt" | "reviewedAt">,
): boolean {
  if (!RRP_DIRECTORY_PIPELINE_STATUSES.includes(application.status)) {
    return false;
  }
  if (!application.submittedAt) {
    return false;
  }
  if (!application.reviewedAt) {
    return true;
  }
  return application.submittedAt > application.reviewedAt;
}

/**
 * Build directory RRP summary for one participant.
 * Representative classification remains active-appointment-only.
 * Approved applications stay viewable after appointment revocation (admin history).
 */
export function buildRrpSummaryForParticipant(input: {
  applications: readonly RrpApplicationRecord[];
  appointments: readonly RrpAppointmentRecord[];
}): AdminParticipantRrpSummary | undefined {
  const classifications = new Set<AdminRrpDirectoryClassification>();
  const activeApplicationIds: string[] = [];
  const activeAppointmentIds: string[] = [];
  const representCountryCodes = new Set<string>();
  const viewableIds = new Set<string>();
  const applicationsById = new Map<string, RrpApplicationRecord>();

  for (const application of input.applications) {
    applicationsById.set(application.applicationId, application);
    if (RRP_DIRECTORY_PIPELINE_STATUSES.includes(application.status)) {
      activeApplicationIds.push(application.applicationId);
      viewableIds.add(application.applicationId);
      representCountryCodes.add(application.representCountryCode);
      if (application.fundingModel === "SELF") {
        classifications.add("applicant_self_funded");
      } else if (application.fundingModel === "PARTIAL") {
        classifications.add("applicant_partial_funding");
      } else if (application.fundingModel === "FULL") {
        classifications.add("applicant_full_funding");
      } else {
        // HU-RRP-04B — funding optional; keep unspecified applicants discoverable.
        classifications.add("applicant_funding_unspecified");
      }
      continue;
    }

    // HU-RRP-FINAL-03C — keep approved application history openable after revoke.
    // Do not classify as applicant/representative from approved status alone.
    if (application.status === "approved") {
      viewableIds.add(application.applicationId);
      representCountryCodes.add(application.representCountryCode);
    }
  }

  for (const appointment of input.appointments) {
    if (appointment.status === "active") {
      classifications.add("representative");
      activeAppointmentIds.push(appointment.appointmentId);
      representCountryCodes.add(appointment.representCountryCode);
      viewableIds.add(appointment.sourceApplicationId);
    }
  }

  if (
    classifications.size === 0 &&
    activeApplicationIds.length === 0 &&
    activeAppointmentIds.length === 0 &&
    viewableIds.size === 0
  ) {
    return undefined;
  }

  const applicationSummaries = [...viewableIds]
    .map((applicationId) => applicationsById.get(applicationId))
    .filter((application): application is RrpApplicationRecord => Boolean(application))
    .map((application) => ({
      applicationId: application.applicationId,
      status: application.status,
      representCountryCode: application.representCountryCode,
      needsAdminAttention: deriveRrpApplicationNeedsAdminAttention(application),
    }));

  return {
    classifications: [...classifications],
    activeApplicationIds,
    activeAppointmentIds,
    viewableApplicationIds: [...viewableIds],
    representCountryCodes: [...representCountryCodes],
    applications: applicationSummaries,
    needsAdminAttention: applicationSummaries.some((item) => item.needsAdminAttention),
  };
}
