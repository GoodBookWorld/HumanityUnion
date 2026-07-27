import type { MembershipSummary } from "@hu/types";

interface MembershipCohortBadgeProps {
  cohortLabel: MembershipSummary["cohortLabel"];
}

export function MembershipCohortBadge({ cohortLabel }: MembershipCohortBadgeProps) {
  const variant = cohortLabel === "Member" ? "member" : "participant";

  return (
    <span className={`membership-cohort-badge membership-cohort-badge--${variant}`}>
      {cohortLabel}
    </span>
  );
}
