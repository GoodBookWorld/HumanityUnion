"use client";

import type { MembershipMePayload } from "@hu/types";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { MemberWorkspace } from "../../../components/member/MemberWorkspace";
import { Button } from "../../../design-system/components/Button";
import { Card } from "../../../design-system/components/Card";
import { LoadingState } from "../../../design-system";
import { formatAuthFormError, isAuthenticationRequiredError } from "../../../lib/api-client";
import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import { useLocalizedBrand } from "../../brand-localization/useLocalizedBrand";
import { WorkspaceNavigation } from "../../initiatives/components/WorkspaceNavigation";
import { getMembershipMe } from "../membership-api";
import { isActiveMembershipStatus } from "../membership-formatters";
import { isMembershipSuccessPreviewEnabled } from "../membership-success.config";

import { MembershipMemberBadgeOffer } from "./MembershipMemberBadgeOffer";
import { MembershipSuccessConfirmationCard } from "./MembershipSuccessConfirmationCard";
import { MembershipSuccessHero } from "./MembershipSuccessHero";
import { MembershipSuccessMeaningCard } from "./MembershipSuccessMeaningCard";
import { MembershipSuccessPermanentNote } from "./MembershipSuccessPermanentNote";
import { MembershipVotingExplanation } from "./MembershipVotingExplanation";
import "./membership-success-page.css";

function MembershipSuccessContent({
  payload,
  previewWithoutActivation = false,
}: {
  payload: MembershipMePayload;
  previewWithoutActivation?: boolean;
}) {
  const t = useTranslations("membershipPublic.successPage");
  const showConfirmation = isActiveMembershipStatus(payload.membership.status);

  return (
    <div className="membership-success-page">
      {previewWithoutActivation ? (
        <div className="membership-success-preview-banner hu-card" role="status">
          {t("previewBanner")}
        </div>
      ) : null}
      <MembershipSuccessHero />
      <div className="membership-success-page__grid">
        <MembershipSuccessConfirmationCard
          memberNumber={showConfirmation ? payload.membership.memberNumber : null}
          memberSince={showConfirmation ? payload.membership.memberSince : null}
        />
        <MembershipSuccessMeaningCard />
      </div>
      <MembershipSuccessPermanentNote />
      <MembershipMemberBadgeOffer />
      <MembershipVotingExplanation className="membership-success-page__voting-note" />
      <div className="membership-success-page__actions">
        <Button href="/membership" variant="secondary">
          {t("viewMembership")}
        </Button>
        <Button href="/workspace" variant="primary">
          {t("returnToWorkspace")}
        </Button>
      </div>
    </div>
  );
}

function MembershipSuccessUnavailable({ message }: { message: string }) {
  const t = useTranslations("membershipPublic.successPage");
  return (
    <div className="membership-success-page membership-success-page--unavailable">
      <Card>
        <h1>{t("title")}</h1>
        <p role="status">{message}</p>
        <Button href="/membership" variant="primary">
          {t("returnToMembership")}
        </Button>
      </Card>
    </div>
  );
}

function MembershipSuccessBody() {
  const t = useTranslations("membershipPublic.successPage");
  const router = useRouter();
  const authStatus = useClientAuthStatus();
  const [payload, setPayload] = useState<MembershipMePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      setLoading(false);
      return;
    }

    let cancelled = false;

    void getMembershipMe()
      .then((result) => {
        if (cancelled) {
          return;
        }

        setPayload(result);
        setError(null);

        const previewEnabled = isMembershipSuccessPreviewEnabled();
        const isActive = isActiveMembershipStatus(result.membership.status);

        if (!isActive && !previewEnabled) {
          router.replace("/membership");
        }
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }

        if (isAuthenticationRequiredError(loadError)) {
          router.replace("/login?returnTo=/membership/success");
          return;
        }

        setError(formatAuthFormError(loadError));
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authStatus, router]);

  if (authStatus === "pending" || loading) {
    return <LoadingState message={t("loading")} />;
  }

  if (authStatus === "unauthenticated") {
    return <MembershipSuccessUnavailable message={t("signInRequired")} />;
  }

  if (error) {
    return <MembershipSuccessUnavailable message={error} />;
  }

  if (!payload) {
    return <MembershipSuccessUnavailable message={t("unavailable")} />;
  }

  const previewEnabled = isMembershipSuccessPreviewEnabled();
  const isActive = isActiveMembershipStatus(payload.membership.status);

  if (!isActive && !previewEnabled) {
    return <MembershipSuccessUnavailable message={t("activationUnavailable")} />;
  }

  return (
    <MembershipSuccessContent
      payload={payload}
      previewWithoutActivation={previewEnabled && !isActive}
    />
  );
}

export function MembershipSuccessPageContent() {
  const t = useTranslations("membershipPublic.successPage");
  const brand = useLocalizedBrand();
  const authStatus = useClientAuthStatus();

  if (authStatus === "authenticated") {
    return (
      <MemberWorkspace
        title={t("title")}
        subtitle={t("subtitle", { siteName: brand.siteName })}
        workspaceNavigation={<WorkspaceNavigation />}
      >
        <MembershipSuccessBody />
      </MemberWorkspace>
    );
  }

  return (
    <div className="membership-page-shell">
      <MembershipSuccessBody />
    </div>
  );
}
