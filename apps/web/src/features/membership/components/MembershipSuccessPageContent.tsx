"use client";

import type { MembershipMePayload } from "@hu/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { MemberWorkspace } from "../../../components/member/MemberWorkspace";
import { Button } from "../../../design-system/components/Button";
import { Card } from "../../../design-system/components/Card";
import { LoadingState } from "../../../design-system";
import { formatAuthFormError, isAuthenticationRequiredError } from "../../../lib/api-client";
import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import { WorkspaceNavigation } from "../../initiatives/components/WorkspaceNavigation";
import { getMembershipMe } from "../membership-api";
import { MEMBERSHIP_ACTIVATION_UNAVAILABLE } from "../membership.constants";
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
  const showConfirmation = isActiveMembershipStatus(payload.membership.status);

  return (
    <div className="membership-success-page">
      {previewWithoutActivation ? (
        <div className="membership-success-preview-banner hu-card" role="status">
          Development preview mode is enabled. Member confirmation details appear only after
          backend-confirmed Membership activation.
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
          View Membership
        </Button>
        <Button href="/workspace" variant="primary">
          Return to Workspace
        </Button>
      </div>
    </div>
  );
}

function MembershipSuccessUnavailable({ message }: { message: string }) {
  return (
    <div className="membership-success-page membership-success-page--unavailable">
      <Card>
        <h1>Membership Success</h1>
        <p role="status">{message}</p>
        <Button href="/membership" variant="primary">
          Return to Membership
        </Button>
      </Card>
    </div>
  );
}

function MembershipSuccessBody() {
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
    return <LoadingState message="Loading Membership success..." />;
  }

  if (authStatus === "unauthenticated") {
    return <MembershipSuccessUnavailable message="Sign in to view your Membership confirmation." />;
  }

  if (error) {
    return <MembershipSuccessUnavailable message={error} />;
  }

  if (!payload) {
    return <MembershipSuccessUnavailable message="Membership confirmation is unavailable." />;
  }

  const previewEnabled = isMembershipSuccessPreviewEnabled();
  const isActive = isActiveMembershipStatus(payload.membership.status);

  if (!isActive && !previewEnabled) {
    return <MembershipSuccessUnavailable message={MEMBERSHIP_ACTIVATION_UNAVAILABLE} />;
  }

  return (
    <MembershipSuccessContent
      payload={payload}
      previewWithoutActivation={previewEnabled && !isActive}
    />
  );
}

export function MembershipSuccessPageContent() {
  const authStatus = useClientAuthStatus();

  if (authStatus === "authenticated") {
    return (
      <MemberWorkspace
        title="Membership Success"
        subtitle="Thank you for supporting Humanity Union"
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
