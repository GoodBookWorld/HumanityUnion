"use client";

import type { MemberBadgeContributionSummary } from "@hu/types";
import { useEffect, useState } from "react";

import { MemberWorkspace } from "../../../components/member/MemberWorkspace";
import { Button } from "../../../design-system/components/Button";
import { Card } from "../../../design-system/components/Card";
import { LoadingState } from "../../../design-system";
import { formatAuthFormError } from "../../../lib/api-client";
import { WorkspaceNavigation } from "../../initiatives/components/WorkspaceNavigation";
import { listMemberBadgeRequests } from "../member-badge-api";
import { MEMBER_BADGE_PAGE_COPY } from "../member-badge.constants";
import {
  formatMemberBadgeAmount,
  formatMemberBadgeContributionStatus,
  formatMemberBadgeFulfillmentStatus,
} from "../member-badge-formatters";

import "./member-badge-page.css";

export function MemberBadgeRequestsPageContent() {
  const [requests, setRequests] = useState<MemberBadgeContributionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listMemberBadgeRequests()
      .then(setRequests)
      .catch((loadError) => setError(formatAuthFormError(loadError)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <MemberWorkspace
      title="Member Badge Requests"
      subtitle="Private request history"
      workspaceNavigation={<WorkspaceNavigation />}
    >
      {loading ? <LoadingState message="Loading Badge requests..." /> : null}
      {error ? (
        <Card>
          <p role="alert">{error}</p>
        </Card>
      ) : null}
      {!loading && !error && requests.length === 0 ? (
        <Card>
          <p role="status">{MEMBER_BADGE_PAGE_COPY.emptyRequests}</p>
          <Button href="/membership/member-badge" variant="primary">
            Member Badge Information
          </Button>
        </Card>
      ) : null}
      {!loading && !error && requests.length > 0 ? (
        <ul className="member-badge-page__history-list">
          {requests.map((request) => (
            <li key={request.badgeContributionId}>
              <Card className="member-badge-requests-page">
                <p>
                  <strong>{request.badgeRequestNumber}</strong>
                </p>
                <p>{new Date(request.createdAt).toLocaleDateString()}</p>
                <p>{formatMemberBadgeContributionStatus(request.contributionStatus)}</p>
                <p>{formatMemberBadgeFulfillmentStatus(request.fulfillmentStatus)}</p>
                <p>
                  Total:{" "}
                  {request.totalProcessedAmountCents != null
                    ? formatMemberBadgeAmount(request.totalProcessedAmountCents, request.currency)
                    : "—"}
                </p>
                <Button
                  href={`/membership/member-badge/requests/${request.badgeContributionId}`}
                  variant="secondary"
                >
                  View Details
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}
    </MemberWorkspace>
  );
}
