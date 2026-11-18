import type {
  AdminParticipantDirectoryItem,
  AdminRrpDirectoryClassification,
} from "@hu/types";
import { ADMIN_RRP_DIRECTORY_CLASSIFICATIONS } from "@hu/types";

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
