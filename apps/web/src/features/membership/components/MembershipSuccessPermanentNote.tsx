import { Card } from "../../../design-system/components/Card";
import { MEMBERSHIP_SUCCESS_COPY } from "../membership.constants";

export function MembershipSuccessPermanentNote() {
  return (
    <section
      className="membership-success-section"
      aria-labelledby="membership-success-permanent-title"
    >
      <Card className="membership-success-permanent">
        <h2 id="membership-success-permanent-title" className="membership-success-permanent__title">
          {MEMBERSHIP_SUCCESS_COPY.permanentTitle}
        </h2>
        <p>{MEMBERSHIP_SUCCESS_COPY.permanentBody}</p>
      </Card>
    </section>
  );
}
