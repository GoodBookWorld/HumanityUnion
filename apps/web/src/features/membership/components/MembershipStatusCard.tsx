import type { MembershipSummary } from "@hu/types";
import { useTranslations } from "next-intl";

import { Card } from "../../../design-system/components/Card";
import { SectionHeader } from "../../../design-system/components/SectionHeader";
import { isActiveMembershipStatus, formatMemberSince } from "../membership-formatters";
import {
  membershipApplicationStatusLabelKey,
  membershipContributionStatusLabelKey,
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
 * Pack 08I.7 — status chrome + label catalogs via membershipPublic.
 */
export function MembershipStatusCard({ membership }: MembershipStatusCardProps) {
  const t = useTranslations("membershipPublic");
  const isActiveMember = isActiveMembershipStatus(membership.status);
  const applicationStarted = membership.applicationStatus !== "not_started";
  const contributionReached =
    isActiveMember ||
    membership.status === "application_completed" ||
    membership.status === "pending_payment";

  const tiles: MembershipFactTile[] = [
    {
      id: "current-status",
      label: t("status.currentStatus"),
      value: membership.cohortLabel,
      tone: "pale-blue",
    },
  ];

  if (applicationStarted) {
    const applicationKey = membershipApplicationStatusLabelKey(membership.applicationStatus);
    tiles.push({
      id: "application-status",
      label: t("status.applicationStatus"),
      value: t(`labels.applicationStatus.${applicationKey}`),
      tone: "pale-amber",
    });
  }

  if (isActiveMember) {
    tiles.push({
      id: "member-number",
      label: t("status.memberNumber"),
      value: membership.memberNumber ?? "—",
      tone: "pale-green",
    });
    tiles.push({
      id: "member-since",
      label: t("status.memberSince"),
      value: formatMemberSince(membership.memberSince),
      tone: "pale-violet",
    });
  }

  if (contributionReached) {
    const contributionKey = membershipContributionStatusLabelKey(membership.status);
    tiles.push({
      id: "contribution",
      label: t("status.contribution"),
      value: t(`labels.contributionStatus.${contributionKey}`),
      tone: "pale-cyan",
    });
  }

  return (
    <section className="membership-section" aria-labelledby="membership-status-title">
      <SectionHeader title={t("status.title")} titleId="membership-status-title" />
      <Card className="membership-status-card">
        <div className="membership-status-card__badge-row">
          {isActiveMember ? (
            <div className="membership-active-member-row">
              <MembershipCohortBadge
                cohortLabel="Member"
                displayLabel={t("status.memberCohort")}
              />
              <MemberBadgeIcon size="medium" decorative />
            </div>
          ) : (
            <MembershipCohortBadge cohortLabel={membership.cohortLabel} />
          )}
        </div>
        <MembershipFactsTiles tiles={tiles} ariaLabel={t("status.ariaFacts")} />
      </Card>
    </section>
  );
}
