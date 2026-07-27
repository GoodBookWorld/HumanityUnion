"use client";

import type { MemberBadgeContributionDetail } from "@hu/types";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { MemberWorkspace } from "../../../components/member/MemberWorkspace";
import { Button } from "../../../design-system/components/Button";
import { Card } from "../../../design-system/components/Card";
import { LoadingState } from "../../../design-system";
import { formatAuthFormError } from "../../../lib/api-client";
import { WorkspaceNavigation } from "../../initiatives/components/WorkspaceNavigation";
import { getMemberBadgeRequestDetail } from "../member-badge-api";
import {
  formatMemberBadgeAmount,
  formatMemberBadgeContributionStatus,
  formatMemberBadgeFulfillmentStatus,
} from "../member-badge-formatters";
import { MEMBER_BADGE_PRODUCT } from "../membership.constants";

import { MemberBadgeIcon } from "./MemberBadgeIcon";
import { formatMemberSince } from "../membership-formatters";
import "./member-badge-page.css";

export function MemberBadgeRequestDetailPageContent() {
  const params = useParams<{ badgeContributionId: string }>();
  const badgeContributionId = params.badgeContributionId;
  const [detail, setDetail] = useState<MemberBadgeContributionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!badgeContributionId) {
      setLoading(false);
      setError("Badge request not found.");
      return;
    }

    void getMemberBadgeRequestDetail(badgeContributionId)
      .then(setDetail)
      .catch((loadError) => setError(formatAuthFormError(loadError)))
      .finally(() => setLoading(false));
  }, [badgeContributionId]);

  return (
    <MemberWorkspace
      title="Badge Request Details"
      subtitle="Private request information"
      workspaceNavigation={<WorkspaceNavigation />}
    >
      {loading ? <LoadingState message="Loading Badge request..." /> : null}
      {error ? (
        <Card>
          <p role="alert">{error}</p>
          <Button href="/membership/member-badge/requests" variant="secondary">
            Back to Requests
          </Button>
        </Card>
      ) : null}
      {detail ? (
        <Card className="member-badge-request-detail-page">
          <MemberBadgeIcon size="medium" />
          <h1>{MEMBER_BADGE_PRODUCT.productName}</h1>
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
            <strong>Contribution status:</strong>{" "}
            {formatMemberBadgeContributionStatus(detail.contributionStatus)}
          </p>
          <p>
            <strong>Fulfillment status:</strong>{" "}
            {formatMemberBadgeFulfillmentStatus(detail.fulfillmentStatus)}
          </p>
          {detail.shippingMethod ? (
            <p>
              <strong>Shipping method:</strong> {detail.shippingMethod}
            </p>
          ) : null}
          {detail.shippingAddressSummary ? (
            <p>
              <strong>Shipping summary:</strong> {detail.shippingAddressSummary}
            </p>
          ) : null}
          {detail.trackingCarrier && detail.trackingNumber ? (
            <p>
              <strong>Tracking:</strong> {detail.trackingCarrier} — {detail.trackingNumber}
            </p>
          ) : null}
          <p>
            <strong>Created:</strong> {formatMemberSince(detail.createdAt)}
          </p>
          {detail.confirmedAt ? (
            <p>
              <strong>Confirmed:</strong> {formatMemberSince(detail.confirmedAt)}
            </p>
          ) : null}
          {detail.shippedAt ? (
            <p>
              <strong>Shipped:</strong> {formatMemberSince(detail.shippedAt)}
            </p>
          ) : null}
          {detail.deliveredAt ? (
            <p>
              <strong>Delivered:</strong> {formatMemberSince(detail.deliveredAt)}
            </p>
          ) : null}
          <Button href="/membership/member-badge/requests" variant="secondary">
            Back to Requests
          </Button>
        </Card>
      ) : null}
    </MemberWorkspace>
  );
}
