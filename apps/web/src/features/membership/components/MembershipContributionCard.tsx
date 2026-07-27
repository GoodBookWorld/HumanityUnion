import type { MembershipMePayload } from "@hu/types";
import { useState } from "react";

import { Button } from "../../../design-system/components/Button";
import { Card } from "../../../design-system/components/Card";
import { SectionHeader } from "../../../design-system/components/SectionHeader";
import { formatAuthFormError } from "../../../lib/api-client";
import { startMembershipContribution } from "../membership-api";

function isApplicationSubmitted(payload: MembershipMePayload): boolean {
  return (
    payload.membership.applicationStatus === "submitted" ||
    payload.membership.applicationStatus === "approved"
  );
}

export function MembershipContributionCard({
  payload,
  contributionCancelled,
}: {
  payload: MembershipMePayload;
  contributionCancelled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isActiveMember = payload.membership.status === "active_member";
  const canContribute =
    payload.emailConfirmed && isApplicationSubmitted(payload) && !isActiveMember;

  async function handleBecomeMember(): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      const session = await startMembershipContribution();
      window.location.assign(session.checkoutUrl);
    } catch (startError) {
      setError(formatAuthFormError(startError));
      setLoading(false);
    }
  }

  return (
    <section className="membership-section" aria-labelledby="membership-contribution-title">
      <SectionHeader title="Membership Contribution" />
      <Card className="membership-contribution-card">
        {contributionCancelled ? (
          <p className="membership-contribution-card__notice" role="status">
            Membership Contribution was not completed.
          </p>
        ) : null}

        {isActiveMember ? (
          <>
            <p className="membership-contribution-card__body">Membership already active.</p>
            {payload.membership.memberNumber ? (
              <p className="membership-contribution-card__meta">
                Member Number: {payload.membership.memberNumber}
              </p>
            ) : null}
          </>
        ) : (
          <>
            <p className="membership-contribution-card__body">
              Membership becomes active after a voluntary one-time Membership Contribution of 1 CAD.
            </p>
            <p className="membership-contribution-card__body">
              This is not a donation, subscription, or identity verification fee.
            </p>

            {!payload.emailConfirmed ? (
              <p className="membership-contribution-card__hint">
                Confirm your email address before completing Membership Contribution.
              </p>
            ) : null}

            {payload.emailConfirmed && !isApplicationSubmitted(payload) ? (
              <p className="membership-contribution-card__hint">
                Submit your Membership application before completing Membership Contribution.
              </p>
            ) : null}

            {error ? <p className="membership-contribution-card__error">{error}</p> : null}

            <div className="membership-contribution-card__actions">
              <Button
                variant="primary"
                disabled={!canContribute || loading}
                onClick={() => {
                  void handleBecomeMember();
                }}
              >
                {loading ? "Preparing..." : "Become a Member"}
              </Button>
            </div>
          </>
        )}
      </Card>
    </section>
  );
}
