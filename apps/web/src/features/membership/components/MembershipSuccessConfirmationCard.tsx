import { Card } from "../../../design-system/components/Card";
import { MEMBERSHIP_CONTRIBUTION_AMOUNT, MEMBERSHIP_SUCCESS_COPY } from "../membership.constants";
import { formatMemberSince } from "../membership-formatters";

interface MembershipSuccessConfirmationCardProps {
  memberNumber: string | null;
  memberSince: string | null;
}

export function MembershipSuccessConfirmationCard({
  memberNumber,
  memberSince,
}: MembershipSuccessConfirmationCardProps) {
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
            {MEMBERSHIP_SUCCESS_COPY.confirmationTitle}
          </h2>
        </div>
        <dl className="membership-success-confirmation__fields">
          <div className="membership-success-confirmation__field">
            <dt>{MEMBERSHIP_SUCCESS_COPY.confirmationContributionLabel}</dt>
            <dd>{MEMBERSHIP_CONTRIBUTION_AMOUNT}</dd>
          </div>
          <div className="membership-success-confirmation__field">
            <dt>Member Since</dt>
            <dd>{hasMemberSince ? formatMemberSince(memberSince) : "Unavailable"}</dd>
          </div>
          <div className="membership-success-confirmation__field membership-success-confirmation__field--number">
            <dt>Member Number</dt>
            <dd>{hasMemberNumber ? memberNumber : "Unavailable"}</dd>
          </div>
        </dl>
        {hasMemberNumber && hasMemberSince ? (
          <p className="membership-success-confirmation__public-note" role="status">
            {MEMBERSHIP_SUCCESS_COPY.publicMemberNote}
          </p>
        ) : (
          <p className="membership-success-unavailable" role="status">
            Membership confirmation details are temporarily unavailable.
          </p>
        )}
      </Card>
    </section>
  );
}
