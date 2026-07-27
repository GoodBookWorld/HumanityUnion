"use client";

import type { MemberBadgeContributionAvailability } from "@hu/types";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { MemberWorkspace } from "../../../components/member/MemberWorkspace";
import { Button } from "../../../design-system/components/Button";
import { Card } from "../../../design-system/components/Card";
import { LoadingState } from "../../../design-system";
import { formatAuthFormError } from "../../../lib/api-client";
import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import { WorkspaceNavigation } from "../../initiatives/components/WorkspaceNavigation";
import {
  getMemberBadgeAvailability,
  listMemberBadgeRequests,
  startMemberBadgeContribution,
} from "../member-badge-api";
import { MEMBER_BADGE_FAQ, MEMBER_BADGE_PAGE_COPY } from "../member-badge.constants";
import {
  formatMemberBadgeContributionStatus,
  formatMemberBadgeFulfillmentStatus,
} from "../member-badge-formatters";

import { MemberBadgeIcon } from "./MemberBadgeIcon";
import "./member-badge-page.css";

function MemberBadgeCta({
  availability,
  loading,
  onRequest,
}: {
  availability: MemberBadgeContributionAvailability | null;
  loading: boolean;
  onRequest: () => void;
}) {
  if (!availability?.enabled) {
    return (
      <>
        <Button variant="secondary" disabled aria-disabled="true">
          Coming Soon
        </Button>
        <p className="member-badge-page__cta-note" role="status">
          {MEMBER_BADGE_PAGE_COPY.disabledMessage}
        </p>
      </>
    );
  }

  if (!availability.eligible) {
    const reason = availability.reason ?? MEMBER_BADGE_PAGE_COPY.eligibilityBody;

    if (reason.toLowerCase().includes("sign in")) {
      return (
        <Button href="/login?returnTo=/membership/member-badge" variant="primary">
          Log In
        </Button>
      );
    }

    return (
      <>
        <Button href="/membership" variant="primary">
          Become a Member
        </Button>
        <p className="member-badge-page__cta-note" role="status">
          {reason}
        </p>
      </>
    );
  }

  return (
    <>
      <Button variant="primary" disabled={loading} onClick={onRequest}>
        Request Member Badge
      </Button>
      <p className="member-badge-page__cta-note">
        You will complete shipping and payment through a secure Checkout flow.
      </p>
    </>
  );
}

function MemberBadgePageBody() {
  const searchParams = useSearchParams();
  const authStatus = useClientAuthStatus();
  const [availability, setAvailability] = useState<MemberBadgeContributionAvailability | null>(
    null,
  );
  const [requests, setRequests] = useState<Awaited<
    ReturnType<typeof listMemberBadgeRequests>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contributionCancelled = searchParams.get("contribution") === "cancelled";

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const availabilityResult = await getMemberBadgeAvailability();
      setAvailability(availabilityResult);

      if (authStatus === "authenticated") {
        const requestList = await listMemberBadgeRequests().catch(() => []);
        setRequests(requestList);
      } else {
        setRequests(null);
      }
    } catch (loadError) {
      setError(formatAuthFormError(loadError));
    } finally {
      setLoading(false);
    }
  }, [authStatus]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const handleRequest = async () => {
    setCheckoutLoading(true);
    setError(null);

    try {
      const checkout = await startMemberBadgeContribution();
      window.location.assign(checkout.checkoutUrl);
    } catch (checkoutError) {
      setError(formatAuthFormError(checkoutError));
      setCheckoutLoading(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading Member Badge information..." />;
  }

  return (
    <div className="member-badge-page">
      {contributionCancelled ? (
        <div className="member-badge-page__banner hu-card" role="status">
          {MEMBER_BADGE_PAGE_COPY.cancelMessage}
        </div>
      ) : null}

      {error ? (
        <div className="member-badge-page__banner member-badge-page__banner--error" role="alert">
          {error}
        </div>
      ) : null}

      <section className="member-badge-page__hero" aria-labelledby="member-badge-hero-title">
        <h1 id="member-badge-hero-title">{MEMBER_BADGE_PAGE_COPY.heroTitle}</h1>
        <p>{MEMBER_BADGE_PAGE_COPY.heroSubtitle}</p>
      </section>

      <Card className="member-badge-page__artwork-card">
        <MemberBadgeIcon size="feature" />
      </Card>

      <section aria-labelledby="member-badge-meaning-title">
        <h2 id="member-badge-meaning-title">{MEMBER_BADGE_PAGE_COPY.meaningTitle}</h2>
        <p>{MEMBER_BADGE_PAGE_COPY.meaningBody}</p>
      </section>

      <section aria-labelledby="member-badge-contribution-title">
        <h2 id="member-badge-contribution-title">{MEMBER_BADGE_PAGE_COPY.contributionTitle}</h2>
        <p className="member-badge-page__amount">
          {availability?.contributionAmountCad ?? MEMBER_BADGE_PAGE_COPY.contributionAmount}
        </p>
        <p>{MEMBER_BADGE_PAGE_COPY.contributionNote}</p>
        <p>{MEMBER_BADGE_PAGE_COPY.optionalClarification}</p>
      </section>

      <section aria-labelledby="member-badge-shipping-title">
        <h2 id="member-badge-shipping-title">{MEMBER_BADGE_PAGE_COPY.shippingTitle}</h2>
        <p>{MEMBER_BADGE_PAGE_COPY.shippingBody}</p>
        {availability?.shippingCountries?.length ? (
          <p>Configured destinations: {availability.shippingCountries.join(", ")}</p>
        ) : null}
      </section>

      <section aria-labelledby="member-badge-eligibility-title">
        <h2 id="member-badge-eligibility-title">{MEMBER_BADGE_PAGE_COPY.eligibilityTitle}</h2>
        <p>{MEMBER_BADGE_PAGE_COPY.eligibilityBody}</p>
        <div className="member-badge-page__cta">
          <MemberBadgeCta
            availability={availability}
            loading={checkoutLoading}
            onRequest={() => void handleRequest()}
          />
        </div>
      </section>

      {authStatus === "authenticated" ? (
        <section aria-labelledby="member-badge-history-title">
          <div className="member-badge-page__history-header">
            <h2 id="member-badge-history-title">Your Badge Requests</h2>
            <Link href="/membership/member-badge/requests">View all</Link>
          </div>
          {requests && requests.length > 0 ? (
            <ul className="member-badge-page__history-list">
              {requests.slice(0, 3).map((request) => (
                <li key={request.badgeContributionId}>
                  <Card>
                    <p>
                      <strong>{request.badgeRequestNumber}</strong>
                    </p>
                    <p>{formatMemberBadgeContributionStatus(request.contributionStatus)}</p>
                    <p>{formatMemberBadgeFulfillmentStatus(request.fulfillmentStatus)}</p>
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
          ) : (
            <p role="status">{MEMBER_BADGE_PAGE_COPY.emptyRequests}</p>
          )}
        </section>
      ) : null}

      <section aria-labelledby="member-badge-faq-title">
        <h2 id="member-badge-faq-title">Frequently Asked Questions</h2>
        <div className="membership-faq-accordion" role="region" aria-label="Member Badge FAQ">
          {MEMBER_BADGE_FAQ.map((entry) => (
            <details key={entry.id} className="membership-faq-accordion__item">
              <summary className="membership-faq-accordion__summary">{entry.question}</summary>
              <div className="membership-faq-accordion__body">
                <p>{entry.answer}</p>
              </div>
            </details>
          ))}
        </div>
      </section>

      <div className="member-badge-page__actions">
        <Button href="/membership" variant="secondary">
          Back to Membership
        </Button>
        {authStatus === "authenticated" ? (
          <Button href="/workspace" variant="primary">
            Return to Workspace
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function MemberBadgePageContent() {
  const authStatus = useClientAuthStatus();

  if (authStatus === "authenticated") {
    return (
      <MemberWorkspace
        title="Official Member Badge"
        subtitle="Optional additional Membership Contribution"
        workspaceNavigation={<WorkspaceNavigation />}
      >
        <MemberBadgePageBody />
      </MemberWorkspace>
    );
  }

  return (
    <div className="membership-page-shell">
      <MemberBadgePageBody />
    </div>
  );
}
