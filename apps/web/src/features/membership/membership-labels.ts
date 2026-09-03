import type { MembershipApplicationStatus, MembershipStatus } from "@hu/types";

/**
 * Pack 08I.7 — semantic status codes stay in storage/API.
 * Components look up display copy via membershipPublic.labels.* catalogs.
 */

export type MembershipContributionStatusLabelKey = "completed" | "awaiting" | "notYet";

export function membershipApplicationStatusLabelKey(
  status: MembershipApplicationStatus,
): MembershipApplicationStatus {
  return status;
}

export function membershipContributionStatusLabelKey(
  status: MembershipStatus,
): MembershipContributionStatusLabelKey {
  if (status === "active_member") {
    return "completed";
  }

  if (status === "application_completed" || status === "pending_payment") {
    return "awaiting";
  }

  return "notYet";
}

/** @deprecated Pack 08I.7 — prefer catalog lookup via membershipApplicationStatusLabelKey + useTranslations. */
export function formatMembershipApplicationStatus(status: MembershipApplicationStatus): string {
  const labels: Record<MembershipApplicationStatus, string> = {
    not_started: "Not Started",
    draft: "Draft",
    submitted: "Submitted",
    approved: "Approved",
    cancelled: "Cancelled",
  };

  return labels[status];
}

/** @deprecated Pack 08I.7 — prefer catalog lookup via membershipContributionStatusLabelKey + useTranslations. */
export function formatMembershipContributionStatus(status: MembershipStatus): string {
  const key = membershipContributionStatusLabelKey(status);
  const labels: Record<MembershipContributionStatusLabelKey, string> = {
    completed: "Completed",
    awaiting: "Awaiting Membership Contribution",
    notYet: "Not yet completed",
  };

  return labels[key];
}

/** @deprecated Pack 08I.7 — prefer membershipPublic.labels.journeySummary via useTranslations. */
export function formatMembershipJourneySummary(
  timeline: { state: "complete" | "current" | "upcoming" }[],
): string {
  const completed = timeline.filter((step) => step.state === "complete").length;
  return `${completed} of ${timeline.length} steps complete`;
}
