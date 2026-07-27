import type { MembershipSummary } from "@hu/types";

import { ProfileField } from "../../../components/member/ProfileField";
import { Card } from "../../../design-system/components/Card";
import { SectionHeader } from "../../../design-system/components/SectionHeader";
import { isActiveMembershipStatus, formatMemberSince } from "../membership-formatters";
import {
  formatMembershipApplicationStatus,
  formatMembershipContributionStatus,
} from "../membership-labels";

import { MemberBadgeIcon } from "./MemberBadgeIcon";
import { MembershipCohortBadge } from "./MembershipCohortBadge";
import "./member-badge-icon.css";

interface MembershipStatusCardProps {
  membership: MembershipSummary;
}

export function MembershipStatusCard({ membership }: MembershipStatusCardProps) {
  const isActiveMember = isActiveMembershipStatus(membership.status);

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
        <dl className="membership-status-card__fields">
          <ProfileField label="Current Status" value={membership.cohortLabel} />
          <ProfileField
            label="Application Status"
            value={formatMembershipApplicationStatus(membership.applicationStatus)}
          />
          {isActiveMember ? (
            <>
              <ProfileField label="Member Number" value={membership.memberNumber ?? "—"} />
              <ProfileField
                label="Member Since"
                value={formatMemberSince(membership.memberSince)}
              />
            </>
          ) : null}
          <ProfileField
            label="Contribution"
            value={formatMembershipContributionStatus(membership.status)}
          />
        </dl>
      </Card>
    </section>
  );
}
