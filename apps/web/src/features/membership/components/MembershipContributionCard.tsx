import type { MembershipMePayload } from "@hu/types";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "../../../design-system/components/Button";
import { Card } from "../../../design-system/components/Card";
import { SectionHeader } from "../../../design-system/components/SectionHeader";
import { formatAuthFormError } from "../../../lib/api-client";
import { MEMBERSHIP_CONTRIBUTION_AMOUNT } from "../membership.constants";
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
  const t = useTranslations("membershipPublic");
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
      <SectionHeader title={t("contribution.title")} titleId="membership-contribution-title" />
      <Card className="membership-contribution-card">
        {contributionCancelled ? (
          <p className="membership-contribution-card__notice" role="status">
            {t("contribution.cancelledNotice")}
          </p>
        ) : null}

        {isActiveMember ? (
          <>
            <p className="membership-contribution-card__body">{t("contribution.alreadyActive")}</p>
            {payload.membership.memberNumber ? (
              <p className="membership-contribution-card__meta">
                {t("contribution.memberNumber", { number: payload.membership.memberNumber })}
              </p>
            ) : null}
          </>
        ) : (
          <>
            <p className="membership-contribution-card__body">
              {t("contribution.bodyPrimary", { amount: MEMBERSHIP_CONTRIBUTION_AMOUNT })}
            </p>
            <p className="membership-contribution-card__body">{t("contribution.bodySecondary")}</p>

            {!payload.emailConfirmed ? (
              <p className="membership-contribution-card__hint">{t("contribution.hintEmail")}</p>
            ) : null}

            {payload.emailConfirmed && !isApplicationSubmitted(payload) ? (
              <p className="membership-contribution-card__hint">
                {t("contribution.hintApplication")}
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
                {loading ? t("contribution.preparing") : t("contribution.cta")}
              </Button>
            </div>
          </>
        )}
      </Card>
    </section>
  );
}
