import type {
  AdminParticipantDirectoryItem,
  AdminParticipantRrpApplicationDirectoryItem,
  AdminRrpDirectoryClassification,
  RrpApplicationStatus,
} from "@hu/types";
import { ADMIN_RRP_DIRECTORY_CLASSIFICATIONS, RRP_APPLICATION_STATUSES } from "@hu/types";

/** Role dropdown values: auth.role filters + derived RRP classifications. */
export type AdminParticipantRoleFilterValue =
  | ""
  | "member"
  | "admin"
  | AdminRrpDirectoryClassification;

export function isAdminRrpDirectoryClassification(
  value: string,
): value is AdminRrpDirectoryClassification {
  return (ADMIN_RRP_DIRECTORY_CLASSIFICATIONS as readonly string[]).includes(value);
}

export function parseAdminParticipantRoleFilter(value: AdminParticipantRoleFilterValue): {
  role?: "member" | "admin";
  rrpClassification?: AdminRrpDirectoryClassification;
} {
  if (value === "member" || value === "admin") {
    return { role: value };
  }
  if (isAdminRrpDirectoryClassification(value)) {
    return { rrpClassification: value };
  }
  return {};
}

/** Application ids the admin can open for the selected participant. */
export function resolveViewableRrpApplicationIds(
  row: AdminParticipantDirectoryItem | null | undefined,
): readonly string[] {
  if (!row?.rrpSummary) {
    return [];
  }
  const fromSummary = row.rrpSummary.viewableApplicationIds;
  if (fromSummary && fromSummary.length > 0) {
    return fromSummary;
  }
  // Backward-compatible fallback if an older payload lacks viewableApplicationIds.
  return row.rrpSummary.activeApplicationIds ?? [];
}

export function canViewRrpApplication(
  row: AdminParticipantDirectoryItem | null | undefined,
): boolean {
  return resolveViewableRrpApplicationIds(row).length > 0;
}

/** HU-RRP-06B — participant-level attention from durable per-application flags. */
export function participantNeedsRrpAdminAttention(
  row: AdminParticipantDirectoryItem | null | undefined,
): boolean {
  if (!row?.rrpSummary) {
    return false;
  }
  if (typeof row.rrpSummary.needsAdminAttention === "boolean") {
    return row.rrpSummary.needsAdminAttention;
  }
  return (row.rrpSummary.applications ?? []).some((item) => item.needsAdminAttention);
}

/**
 * HU-RRP-06B — status column values. Multiple applications stay distinct;
 * never collapse mixed statuses into one participant label.
 */
export function resolveRrpDirectoryApplicationStatuses(
  row: AdminParticipantDirectoryItem | null | undefined,
): readonly AdminParticipantRrpApplicationDirectoryItem[] {
  if (!row?.rrpSummary) {
    return [];
  }
  if (row.rrpSummary.applications && row.rrpSummary.applications.length > 0) {
    return row.rrpSummary.applications;
  }
  // Backward-compatible fallback when older payloads omit applications[].
  return resolveViewableRrpApplicationIds(row).map((applicationId) => ({
    applicationId,
    status: "submitted" as RrpApplicationStatus,
    representCountryCode: row.rrpSummary?.representCountryCodes[0] ?? "",
    needsAdminAttention: false,
  }));
}

export function isRrpApplicationStatus(value: string): value is RrpApplicationStatus {
  return (RRP_APPLICATION_STATUSES as readonly string[]).includes(value);
}

export function isRrpApproveEligibleStatus(status: string): boolean {
  return status === "submitted" || status === "under_review";
}

export function isRrpMarkUnderReviewEligible(status: string): boolean {
  return status === "submitted" || status === "information_requested";
}

export function isRrpRequestInformationEligible(status: string): boolean {
  return status === "submitted" || status === "under_review";
}

export function isRrpRejectEligible(status: string): boolean {
  return (
    status === "submitted" ||
    status === "under_review" ||
    status === "information_requested"
  );
}

/** Revoke only when an active platform designation exists for the application. */
export function isRrpRevokeAppointmentEligible(
  activeAppointment: { status: string } | null | undefined,
): boolean {
  return activeAppointment?.status === "active";
}
