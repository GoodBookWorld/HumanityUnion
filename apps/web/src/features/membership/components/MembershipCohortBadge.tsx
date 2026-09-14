import type { MembershipSummary } from "@hu/types";

interface MembershipCohortBadgeProps {
  cohortLabel: MembershipSummary["cohortLabel"];
  /** Optional localized display; cohortLabel remains the semantic code for styling. */
  displayLabel?: string;
}

export function MembershipCohortBadge({ cohortLabel, displayLabel }: MembershipCohortBadgeProps) {
  const variant = cohortLabel === "Member" ? "member" : "participant";

  return (
    <span className={`membership-cohort-badge membership-cohort-badge--${variant}`}>
      {displayLabel ?? cohortLabel}
    </span>
  );
}
