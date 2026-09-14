"use client";

import type { MembershipMePayload } from "@hu/types";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "../../../design-system/components/Button";
import { formatAuthFormError } from "../../../lib/api-client";
import { getMembershipMe } from "../membership-api";
import { isActiveMembershipStatus } from "../membership-formatters";
import {
  membershipApplicationStatusLabelKey,
  membershipContributionStatusLabelKey,
  membershipJourneyCompletedCount,
} from "../membership-labels";

import { MemberBadgeIcon } from "./MemberBadgeIcon";
import { MembershipCohortBadge } from "./MembershipCohortBadge";
import { MembershipTimeline } from "./MembershipTimeline";
import "./member-badge-icon.css";

/**
 * Workspace Home Membership block — Pack 08I.7 / Task 01.
 * Same WEB_UI authority as MembershipStatusCard (`membershipPublic`);
 * no English formatters or raw `cohortLabel` as display text.
 */
export function MembershipWorkspaceWidget() {
  const t = useTranslations("membershipPublic");
  const [payload, setPayload] = useState<MembershipMePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void getMembershipMe()
      .then((result) => {
        if (!cancelled) {
          setPayload(result);
          setError(null);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(formatAuthFormError(loadError));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <article className="workspace-home-card membership-workspace-widget">
        <h3 className="workspace-home-card__title">{t("pageTitle")}</h3>
        <p>{t("loading")}</p>
      </article>
    );
  }

  if (error || !payload) {
    return (
      <article className="workspace-home-card membership-workspace-widget">
        <h3 className="workspace-home-card__title">{t("pageTitle")}</h3>
        <p>{error ?? t("workspaceWidget.unavailable")}</p>
      </article>
    );
  }

  const { membership } = payload;
  const isActiveMember = isActiveMembershipStatus(membership.status);
  const cohortSemantic = isActiveMember ? "Member" : membership.cohortLabel;
  const cohortDisplayLabel =
    cohortSemantic === "Member" ? t("status.memberCohort") : t("status.participantCohort");
  const applicationKey = membershipApplicationStatusLabelKey(membership.applicationStatus);
  const contributionKey = membershipContributionStatusLabelKey(membership.status);
  const journeyCompleted = membershipJourneyCompletedCount(payload.timeline);

  return (
    <article className="workspace-home-card membership-workspace-widget">
      <h3 className="workspace-home-card__title">{t("pageTitle")}</h3>
      <div className="membership-workspace-widget__badge-row">
        {isActiveMember ? (
          <div className="membership-active-member-row">
            <MembershipCohortBadge
              cohortLabel="Member"
              displayLabel={cohortDisplayLabel}
            />
            <MemberBadgeIcon size="small" decorative />
          </div>
        ) : (
          <MembershipCohortBadge
            cohortLabel={membership.cohortLabel}
            displayLabel={cohortDisplayLabel}
          />
        )}
      </div>
      <ul className="workspace-home-card__list">
        <li>
          <span>{t("status.currentStatus")}</span>
          <span className="workspace-home-card__status">{cohortDisplayLabel}</span>
        </li>
        <li>
          <span>{t("status.applicationStatus")}</span>
          <span className="workspace-home-card__status">
            {t(`labels.applicationStatus.${applicationKey}`)}
          </span>
        </li>
        <li>
          <span>{t("workspaceWidget.journey")}</span>
          <span className="workspace-home-card__status">
            {t("labels.journeySummary", {
              completed: journeyCompleted,
              total: payload.timeline.length,
            })}
          </span>
        </li>
        <li>
          <span>{t("status.contribution")}</span>
          <span className="workspace-home-card__status">
            {t(`labels.contributionStatus.${contributionKey}`)}
          </span>
        </li>
      </ul>
      <div className="membership-workspace-widget__timeline">
        <MembershipTimeline steps={payload.timeline} compact />
      </div>
      <Button href={isActiveMember ? "/membership/success" : "/membership"} variant="primary">
        {isActiveMember
          ? t("workspaceWidget.viewSuccessCta")
          : t("workspaceWidget.continueCta")}
      </Button>
    </article>
  );
}
