"use client";

import { useTranslations } from "next-intl";

import { Card } from "../../../design-system/components/Card";
import { MEMBERSHIP_CONTRIBUTION_AMOUNT } from "../membership.constants";
import { formatMemberSince } from "../membership-formatters";

interface MembershipSuccessConfirmationCardProps {
  memberNumber: string | null;
  memberSince: string | null;
}

export function MembershipSuccessConfirmationCard({
  memberNumber,
  memberSince,
}: MembershipSuccessConfirmationCardProps) {
  const t = useTranslations("membershipPublic.successPage");
  const hasMemberNumber = Boolean(memberNumber);
  const hasMemberSince = Boolean(memberSince);

  return (
    <section
      className="membership-success-section"
      aria-labelledby="membership-success-confirmation-title"
    >
      <Card className="membership-success-confirmation">
        <div className="membership-success-confirmation__header">
          <h2
            id="membership-success-confirmation-title"
            className="membership-success-confirmation__title"
          >
            {t("confirmationTitle")}
          </h2>
        </div>
        <dl className="membership-success-confirmation__fields">
          <div className="membership-success-confirmation__field">
            <dt>{t("confirmationContributionLabel")}</dt>
            <dd>{MEMBERSHIP_CONTRIBUTION_AMOUNT}</dd>
          </div>
          <div className="membership-success-confirmation__field">
            <dt>{t("memberSince")}</dt>
            <dd>{hasMemberSince ? formatMemberSince(memberSince) : t("valueUnavailable")}</dd>
          </div>
          <div className="membership-success-confirmation__field membership-success-confirmation__field--number">
            <dt>{t("memberNumber")}</dt>
            <dd>{hasMemberNumber ? memberNumber : t("valueUnavailable")}</dd>
          </div>
        </dl>
        {hasMemberNumber && hasMemberSince ? (
          <p className="membership-success-confirmation__public-note" role="status">
            {t("publicMemberNote")}
          </p>
        ) : (
          <p className="membership-success-unavailable" role="status">
            {t("confirmationTemporarilyUnavailable")}
          </p>
        )}
      </Card>
    </section>
  );
}
