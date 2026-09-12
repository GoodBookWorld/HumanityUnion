"use client";

import type {
  MemberBadgeContributionAvailability,
  MemberBadgeContributionStatus,
  MemberBadgeFulfillmentStatus,
} from "@hu/types";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { MemberWorkspace } from "../../../components/member/MemberWorkspace";
import { Button } from "../../../design-system/components/Button";
import { Card } from "../../../design-system/components/Card";
import { LoadingState } from "../../../design-system";
import { formatAuthFormError } from "../../../lib/api-client";
import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import { useLocalizedBrand } from "../../brand-localization/useLocalizedBrand";
import { WorkspaceNavigation } from "../../initiatives/components/WorkspaceNavigation";
import {
  getMemberBadgeAvailability,
  listMemberBadgeRequests,
  startMemberBadgeContribution,
} from "../member-badge-api";

import { MemberBadgeIcon } from "./MemberBadgeIcon";
import "./member-badge-page.css";

const BADGE_FAQ_IDS = ["required", "membershipImpact", "amount", "shipping"] as const;

function MemberBadgeCta({
  availability,
  loading,
  onRequest,
  authStatus,
}: {
  availability: MemberBadgeContributionAvailability | null;
  loading: boolean;
  onRequest: () => void;
  authStatus: "pending" | "authenticated" | "unauthenticated";
}) {
  const t = useTranslations("membershipPublic.badgePages");
  const brand = useLocalizedBrand();

  if (!availability?.enabled) {
    return (
      <>
        <Button variant="secondary" disabled aria-disabled="true">
          {t("comingSoon")}
        </Button>
        <p className="member-badge-page__cta-note" role="status">
          {t("disabledMessage")}
        </p>
      </>
    );
  }

  if (!availability.eligible) {
    if (authStatus !== "authenticated") {
      return (
        <Button href="/login?returnTo=/membership/member-badge" variant="primary">
          {t("logIn")}
        </Button>
      );
    }

    return (
      <>
        <Button href="/membership" variant="primary">
          {t("becomeMember")}
        </Button>
        <p className="member-badge-page__cta-note" role="status">
          {t("eligibilityBody", { siteName: brand.siteName })}
        </p>
      </>
    );
  }

  return (
    <>
      <Button variant="primary" disabled={loading} onClick={onRequest}>
        {t("requestCta")}
      </Button>
      <p className="member-badge-page__cta-note">{t("checkoutHint")}</p>
    </>
  );
}

function MemberBadgePageBody() {
  const t = useTranslations("membershipPublic.badgePages");
  const brand = useLocalizedBrand();
  const siteName = { siteName: brand.siteName };
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

  const contributionStatusLabel = (status: MemberBadgeContributionStatus) =>
    t(`contributionStatus.${status}`);
  const fulfillmentStatusLabel = (status: MemberBadgeFulfillmentStatus) =>
    t(`requestFulfillmentStatus.${status}`);

  if (loading) {
    return <LoadingState message={t("loadingInfo")} />;
  }

  return (
    <div className="member-badge-page">
      {contributionCancelled ? (
        <div className="member-badge-page__banner hu-card" role="status">
          {t("cancelMessage")}
        </div>
      ) : null}

      {error ? (
        <div className="member-badge-page__banner member-badge-page__banner--error" role="alert">
          {error}
        </div>
      ) : null}

      <section className="member-badge-page__hero" aria-labelledby="member-badge-hero-title">
        <h1 id="member-badge-hero-title">{t("heroTitle", siteName)}</h1>
        <p>{t("heroSubtitle", siteName)}</p>
      </section>

      <Card className="member-badge-page__artwork-card">
        <MemberBadgeIcon size="feature" />
      </Card>

      <section aria-labelledby="member-badge-meaning-title">
        <h2 id="member-badge-meaning-title">{t("meaningTitle")}</h2>
        <p>{t("meaningBody")}</p>
      </section>

      <section aria-labelledby="member-badge-contribution-title">
        <h2 id="member-badge-contribution-title">{t("contributionTitle")}</h2>
        <p className="member-badge-page__amount">
          {availability?.contributionAmountCad ?? t("contributionAmountFallback")}
        </p>
        <p>{t("contributionNote")}</p>
        <p>{t("optionalClarification")}</p>
      </section>

      <section aria-labelledby="member-badge-shipping-title">
        <h2 id="member-badge-shipping-title">{t("shippingTitle")}</h2>
        <p>{t("shippingBody")}</p>
        {availability?.shippingCountries?.length ? (
          <p>
            {t("configuredDestinations", {
              countries: availability.shippingCountries.join(", "),
            })}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="member-badge-eligibility-title">
        <h2 id="member-badge-eligibility-title">{t("eligibilityTitle")}</h2>
        <p>{t("eligibilityBody", siteName)}</p>
        <div className="member-badge-page__cta">
          <MemberBadgeCta
            availability={availability}
            loading={checkoutLoading}
            authStatus={authStatus}
            onRequest={() => void handleRequest()}
          />
        </div>
      </section>

      {authStatus === "authenticated" ? (
        <section aria-labelledby="member-badge-history-title">
          <div className="member-badge-page__history-header">
            <h2 id="member-badge-history-title">{t("historyTitle")}</h2>
            <Link href="/membership/member-badge/requests">{t("viewAll")}</Link>
          </div>
          {requests && requests.length > 0 ? (
            <ul className="member-badge-page__history-list">
              {requests.slice(0, 3).map((request) => (
                <li key={request.badgeContributionId}>
                  <Card>
                    <p>
                      <strong>{request.badgeRequestNumber}</strong>
                    </p>
                    <p>{contributionStatusLabel(request.contributionStatus)}</p>
                    <p>{fulfillmentStatusLabel(request.fulfillmentStatus)}</p>
                    <Button
                      href={`/membership/member-badge/requests/${request.badgeContributionId}`}
                      variant="secondary"
                    >
                      {t("viewDetails")}
                    </Button>
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <p role="status">{t("emptyRequests")}</p>
          )}
        </section>
      ) : null}

      <section aria-labelledby="member-badge-faq-title">
        <h2 id="member-badge-faq-title">{t("faqTitle")}</h2>
        <div className="membership-faq-accordion" role="region" aria-label={t("faqRegionLabel")}>
          {BADGE_FAQ_IDS.map((id) => (
            <details key={id} className="membership-faq-accordion__item">
              <summary className="membership-faq-accordion__summary">
                {t(`faq.${id}.question`)}
              </summary>
              <div className="membership-faq-accordion__body">
                <p>{t(`faq.${id}.answer`)}</p>
              </div>
            </details>
          ))}
        </div>
      </section>

      <div className="member-badge-page__actions">
        <Button href="/membership" variant="secondary">
          {t("backToMembership")}
        </Button>
        {authStatus === "authenticated" ? (
          <Button href="/workspace" variant="primary">
            {t("returnToWorkspace")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function MemberBadgePageContent() {
  const t = useTranslations("membershipPublic.badgePages");
  const authStatus = useClientAuthStatus();

  if (authStatus === "authenticated") {
    return (
      <MemberWorkspace
        title={t("officialTitle")}
        subtitle={t("officialSubtitle")}
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
