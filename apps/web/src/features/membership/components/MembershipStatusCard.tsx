import type { MembershipSummary } from "@hu/types";

import { Card } from "../../../design-system/components/Card";
import { SectionHeader } from "../../../design-system/components/SectionHeader";
import { isActiveMembershipStatus, formatMemberSince } from "../membership-formatters";
import {
  formatMembershipApplicationStatus,
  formatMembershipContributionStatus,
} from "../membership-labels";

import { MemberBadgeIcon } from "./MemberBadgeIcon";
import { MembershipCohortBadge } from "./MembershipCohortBadge";
import { MembershipFactsTiles, type MembershipFactTile } from "./MembershipFactsTiles";
import "./member-badge-icon.css";
import "./membership-page.css";

interface MembershipStatusCardProps {
  membership: MembershipSummary;
}

/**
 * Pack 25D — show only Membership facts the Participant has reached.
 * Active Members get five equal-width pale tiles on desktop/tablet.
 */
export function MembershipStatusCard({ membership }: MembershipStatusCardProps) {
  const isActiveMember = isActiveMembershipStatus(membership.status);
  const applicationStarted = membership.applicationStatus !== "not_started";
  const contributionReached =
    isActiveMember ||
    membership.status === "application_completed" ||
    membership.status === "pending_payment";

  const tiles: MembershipFactTile[] = [
    {
      id: "current-status",
      label: "Current Status",
      value: membership.cohortLabel,
      tone: "pale-blue",
    },
  ];

  if (applicationStarted) {
    tiles.push({
      id: "application-status",
      label: "Application Status",
      value: formatMembershipApplicationStatus(membership.applicationStatus),
      tone: "pale-amber",
    });
  }

  if (isActiveMember) {
    tiles.push({
      id: "member-number",
      label: "Member Number",
      value: membership.memberNumber ?? "—",
      tone: "pale-green",
    });
    tiles.push({
      id: "member-since",
      label: "Member Since",
      value: formatMemberSince(membership.memberSince),
      tone: "pale-violet",
    });
  }

  if (contributionReached) {
    tiles.push({
      id: "contribution",
      label: "Contribution",
      value: formatMembershipContributionStatus(membership.status),
      tone: "pale-cyan",
    });
  }

  return (
    <section className="membership-section" aria-labelledby="membership-status-title">
      <SectionHeader title="Membership Status" />
      <Card className="membership-status-card">
        <div className="membership-status-card__badge-row">
          {isActiveMember ? (
            <div className="membership-active-member-row">
              <MembershipCohortBadge cohortLabel="Member" />
              <MemberBadgeIcon size="medium" decorative />
            </div>
          ) : (
            <MembershipCohortBadge cohortLabel={membership.cohortLabel} />
          )}
        </div>
        <MembershipFactsTiles tiles={tiles} ariaLabel="Membership status facts" />
      </Card>
    </section>
  );
}
