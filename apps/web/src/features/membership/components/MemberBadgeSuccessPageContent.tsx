"use client";

import type { MemberBadgeContributionDetail } from "@hu/types";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { MemberWorkspace } from "../../../components/member/MemberWorkspace";
import { Button } from "../../../design-system/components/Button";
import { Card } from "../../../design-system/components/Card";
import { LoadingState } from "../../../design-system";
import { formatAuthFormError } from "../../../lib/api-client";
import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import { WorkspaceNavigation } from "../../initiatives/components/WorkspaceNavigation";
import { getMemberBadgeRequestBySession } from "../member-badge-api";
import { MEMBER_BADGE_PAGE_COPY } from "../member-badge.constants";
import {
  formatMemberBadgeAmount,
  formatMemberBadgeFulfillmentStatus,
  isMemberBadgeContributionConfirmed,
  isMemberBadgeContributionProcessing,
} from "../member-badge-formatters";

import { MemberBadgeIcon } from "./MemberBadgeIcon";
import "./member-badge-page.css";

function MemberBadgeSuccessBody() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [detail, setDetail] = useState<MemberBadgeContributionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      setError("Missing Checkout session reference.");
      return;
    }

    let cancelled = false;

    void getMemberBadgeRequestBySession(sessionId)
      .then((result) => {
        if (!cancelled) {
          setDetail(result);
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
  }, [sessionId]);

  if (loading) {
    return <LoadingState message="Loading Badge request status..." />;
  }

  if (!detail || error) {
    return (
      <Card className="member-badge-success-page">
        <h1>Member Badge Contribution</h1>
        <p role="status">
          We could not confirm this Badge request yet. Please review your private Badge Requests or
          try again shortly.
        </p>
        <Button href="/membership/member-badge/requests" variant="primary">
          View Badge Requests
        </Button>
      </Card>
    );
  }

  if (isMemberBadgeContributionProcessing(detail.contributionStatus)) {
    return (
      <Card className="member-badge-success-page">
        <h1>Member Badge Contribution</h1>
        <p role="status">Your contribution is being confirmed.</p>
        <Button href="/membership/member-badge/requests" variant="secondary">
          View Badge Requests
        </Button>
      </Card>
    );
  }

  if (!isMemberBadgeContributionConfirmed(detail.contributionStatus)) {
    return (
      <Card className="member-badge-success-page">
        <h1>Member Badge Contribution</h1>
        <p role="status">
          We could not confirm this Badge request yet. Please review your private Badge Requests or
          try again shortly.
        </p>
        <Button href="/membership/member-badge/requests" variant="primary">
          View Badge Requests
        </Button>
      </Card>
    );
  }

  return (
    <Card className="member-badge-success-page">
      <MemberBadgeIcon size="large" />
      <h1>Member Badge request confirmed</h1>
      <p>Thank you for your additional Membership Contribution.</p>
      <p>Your official Member Badge request has been confirmed.</p>
      <div className="member-badge-success-page__grid">
        <p>
          <strong>Badge Request Number:</strong> {detail.badgeRequestNumber}
        </p>
        <p>
          <strong>Contribution:</strong>{" "}
          {formatMemberBadgeAmount(detail.amountCents, detail.currency)}
        </p>
        <p>
          <strong>Shipping:</strong>{" "}
          {detail.shippingAmountCents != null
            ? formatMemberBadgeAmount(detail.shippingAmountCents, detail.currency)
            : "—"}
        </p>
        <p>
          <strong>Total:</strong>{" "}
          {detail.totalProcessedAmountCents != null
            ? formatMemberBadgeAmount(detail.totalProcessedAmountCents, detail.currency)
            : "—"}
        </p>
        <p>
          <strong>Fulfillment status:</strong>{" "}
          {formatMemberBadgeFulfillmentStatus(detail.fulfillmentStatus)}
        </p>
      </div>
      <Button
        href={`/membership/member-badge/requests/${detail.badgeContributionId}`}
        variant="primary"
      >
        View Request Details
      </Button>
    </Card>
  );
}

export function MemberBadgeSuccessPageContent() {
  const authStatus = useClientAuthStatus();

  if (authStatus === "pending") {
    return <LoadingState message="Loading..." />;
  }

  if (authStatus === "unauthenticated") {
    return (
      <div className="membership-page-shell">
        <Card>
          <h1>{MEMBER_BADGE_PAGE_COPY.heroTitle}</h1>
          <p>Sign in to view your Member Badge request status.</p>
          <Button href="/login?returnTo=/membership/member-badge/success" variant="primary">
            Log In
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <MemberWorkspace
      title="Member Badge Success"
      subtitle="Contribution confirmation"
      workspaceNavigation={<WorkspaceNavigation />}
    >
      <MemberBadgeSuccessBody />
    </MemberWorkspace>
  );
}
