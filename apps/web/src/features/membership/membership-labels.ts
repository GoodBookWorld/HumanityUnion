import type { MembershipApplicationStatus, MembershipStatus } from "@hu/types";

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

export function formatMembershipContributionStatus(status: MembershipStatus): string {
  if (status === "active_member") {
    return "Completed";
  }

  if (status === "application_completed" || status === "pending_payment") {
    return "Awaiting Membership Contribution";
  }

  return "Not yet completed";
}

export function formatMembershipJourneySummary(
  timeline: { state: "complete" | "current" | "upcoming" }[],
): string {
  const completed = timeline.filter((step) => step.state === "complete").length;
  return `${completed} of ${timeline.length} steps complete`;
}
