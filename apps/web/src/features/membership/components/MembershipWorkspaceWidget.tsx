"use client";

import type { MembershipMePayload } from "@hu/types";
import { useEffect, useState } from "react";

import { Button } from "../../../design-system/components/Button";
import { formatAuthFormError } from "../../../lib/api-client";
import { getMembershipMe } from "../membership-api";
import { isActiveMembershipStatus } from "../membership-formatters";
import {
  formatMembershipApplicationStatus,
  formatMembershipContributionStatus,
  formatMembershipJourneySummary,
} from "../membership-labels";

import { MemberBadgeIcon } from "./MemberBadgeIcon";
import { MembershipCohortBadge } from "./MembershipCohortBadge";
import { MembershipTimeline } from "./MembershipTimeline";
import "./member-badge-icon.css";

export function MembershipWorkspaceWidget() {
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
        <h3 className="workspace-home-card__title">Membership</h3>
        <p>Loading Membership...</p>
      </article>
    );
  }

  if (error || !payload) {
    return (
      <article className="workspace-home-card membership-workspace-widget">
        <h3 className="workspace-home-card__title">Membership</h3>
        <p>{error ?? "Membership is unavailable."}</p>
      </article>
    );
  }

  const { membership } = payload;
  const isActiveMember = isActiveMembershipStatus(membership.status);

  return (
    <article className="workspace-home-card membership-workspace-widget">
      <h3 className="workspace-home-card__title">Membership</h3>
      <div className="membership-workspace-widget__badge-row">
        {isActiveMember ? (
          <div className="membership-active-member-row">
            <MembershipCohortBadge cohortLabel="Member" />
            <MemberBadgeIcon size="small" decorative />
          </div>
        ) : (
          <MembershipCohortBadge cohortLabel={membership.cohortLabel} />
        )}
      </div>
      <ul className="workspace-home-card__list">
        <li>
          <span>Status</span>
          <span className="workspace-home-card__status">{membership.cohortLabel}</span>
        </li>
        <li>
          <span>Application</span>
          <span className="workspace-home-card__status">
            {formatMembershipApplicationStatus(membership.applicationStatus)}
          </span>
        </li>
        <li>
          <span>Journey</span>
          <span className="workspace-home-card__status">
            {formatMembershipJourneySummary(payload.timeline)}
          </span>
        </li>
        <li>
          <span>Contribution</span>
          <span className="workspace-home-card__status">
            {formatMembershipContributionStatus(membership.status)}
          </span>
        </li>
      </ul>
      <div className="membership-workspace-widget__timeline">
        <MembershipTimeline steps={payload.timeline} compact />
      </div>
      <Button href={isActiveMember ? "/membership/success" : "/membership"} variant="primary">
        {isActiveMember ? "View Membership Success" : "Continue Membership"}
      </Button>
    </article>
  );
}
