"use client";

import type { MembershipMePayload } from "@hu/types";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { useLocalizedBrand } from "../../brand-localization/useLocalizedBrand";

import { MemberWorkspace } from "../../../components/member/MemberWorkspace";
import { Button } from "../../../design-system/components/Button";
import { Card } from "../../../design-system/components/Card";
import { LoadingState } from "../../../design-system";
import { formatAuthFormError, isAuthenticationRequiredError } from "../../../lib/api-client";
import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import { WorkspaceNavigation } from "../../initiatives/components/WorkspaceNavigation";
import { getMembershipMe } from "../membership-api";

import { MembershipApplicationForm } from "./MembershipApplicationForm";
import { MembershipBenefitsGrid } from "./MembershipBenefitsGrid";
import { MembershipContributionCard } from "./MembershipContributionCard";
import { MembershipFaqAccordion } from "./MembershipFaqAccordion";
import { MembershipPlatformStatisticsSection } from "./MembershipPlatformStatisticsSection";
import { MembershipHero } from "./MembershipHero";
import { MembershipJourneySection } from "./MembershipJourneySection";
import { MembershipMeaningCards } from "./MembershipMeaningCards";
import { MembershipMemberBadgeOffer } from "./MembershipMemberBadgeOffer";
import { MembershipNotMeans } from "./MembershipNotMeans";
import { MembershipStatusCard } from "./MembershipStatusCard";
import { isActiveMembershipStatus } from "../membership-formatters";
import "./membership-page.css";
import "./membership-success-page.css";

function MembershipPublicSections() {
  return (
    <>
      <MembershipMeaningCards />
      <MembershipNotMeans />
      <MembershipBenefitsGrid />
      <MembershipFaqAccordion />
    </>
  );
}

function MembershipAuthenticatedSections({
  payload,
  onUpdated,
  contributionCancelled,
  badgePaymentState,
}: {
  payload: MembershipMePayload;
  onUpdated: (next: MembershipMePayload) => void;
  contributionCancelled?: boolean;
  badgePaymentState?: "success" | "cancelled" | null;
}) {
  const t = useTranslations("membershipPublic");

  return (
    <>
      {badgePaymentState === "cancelled" ? (
        <p className="membership-section" role="status">
          {t("badgePayment.cancelled")}
        </p>
      ) : null}
      {badgePaymentState === "success" ? (
        <p className="membership-section" role="status">
          {t("badgePayment.success")}
        </p>
      ) : null}
      <MembershipStatusCard membership={payload.membership} />
      <MembershipJourneySection steps={payload.timeline} />
      <MembershipApplicationForm payload={payload} onUpdated={onUpdated} />
      <MembershipContributionCard payload={payload} contributionCancelled={contributionCancelled} />
      {isActiveMembershipStatus(payload.membership.status) ? (
        <MembershipMemberBadgeOffer />
      ) : null}
      <section
        className="membership-section"
        aria-labelledby="membership-platform-statistics-title"
      >
        <MembershipPlatformStatisticsSection
          title={t("platformStatisticsTitle")}
          showUpdatedAt
        />
      </section>
      <MembershipPublicSections />
    </>
  );
}

function MembershipSignInPrompt() {
  const t = useTranslations("membershipPublic");

  return (
    <>
      <section className="membership-section" aria-labelledby="membership-sign-in-title">
        <Card className="membership-sign-in-prompt">
          <h2 id="membership-sign-in-title" className="membership-sign-in-prompt__title">
            {t("signIn.title")}
          </h2>
          <p>{t("signIn.body")}</p>
          <div className="membership-sign-in-prompt__actions">
            <Button href="/login?returnTo=/membership" variant="primary">
              {t("signIn.login")}
            </Button>
            <Button href="/register?returnTo=/membership" variant="secondary">
              {t("signIn.register")}
            </Button>
          </div>
        </Card>
      </section>
      <MembershipPublicSections />
    </>
  );
}

function MembershipPageBody({ authStatus }: { authStatus: "authenticated" | "unauthenticated" }) {
  const t = useTranslations("membershipPublic");
  const searchParams = useSearchParams();
  const contributionCancelled = searchParams.get("contribution") === "cancelled";
  const badgePaymentParam = searchParams.get("badgePayment");
  const badgePaymentState =
    badgePaymentParam === "success" || badgePaymentParam === "cancelled"
      ? badgePaymentParam
      : null;
  const [payload, setPayload] = useState<MembershipMePayload | null>(null);
  const [loading, setLoading] = useState(authStatus === "authenticated");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      setPayload(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void getMembershipMe()
      .then((result) => {
        if (!cancelled) {
          setPayload(result);
          setError(null);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          if (isAuthenticationRequiredError(loadError)) {
            setPayload(null);
            return;
          }

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
  }, [authStatus]);

  const cohortLabel = payload?.membership.cohortLabel ?? "Participant";

  if (authStatus === "authenticated" && loading) {
    return (
      <div className="membership-page">
        <MembershipHero cohortLabel={cohortLabel} />
        <LoadingState message={t("loading")} />
      </div>
    );
  }

  if (authStatus === "authenticated" && error && !payload) {
    return (
      <div className="membership-page">
        <MembershipHero cohortLabel={cohortLabel} />
        <Card>{error}</Card>
      </div>
    );
  }

  return (
    <div className="membership-page">
      <MembershipHero cohortLabel={cohortLabel} />
      {authStatus === "authenticated" && payload ? (
        <MembershipAuthenticatedSections
          payload={payload}
          onUpdated={setPayload}
          contributionCancelled={contributionCancelled}
          badgePaymentState={badgePaymentState}
        />
      ) : (
        <MembershipSignInPrompt />
      )}
    </div>
  );
}

export function MembershipPageContent() {
  const t = useTranslations("membershipPublic");
  const brand = useLocalizedBrand();
  const siteName = { siteName: brand.siteName };
  const authStatus = useClientAuthStatus();

  if (authStatus === "pending") {
    return <LoadingState message={t("loading")} />;
  }

  if (authStatus === "authenticated") {
    return (
      <MemberWorkspace
        title={t("pageTitle")}
        subtitle={t("pageSubtitle", siteName)}
        workspaceNavigation={<WorkspaceNavigation />}
      >
        <MembershipPageBody authStatus="authenticated" />
      </MemberWorkspace>
    );
  }

  return (
    <div className="membership-page-shell">
      <header className="membership-page-shell__header">
        <h1 className="membership-page-shell__title">{t("pageTitle")}</h1>
        <p className="membership-page-shell__subtitle">{t("pageSubtitle", siteName)}</p>
      </header>
      <MembershipPageBody authStatus="unauthenticated" />
    </div>
  );
}
