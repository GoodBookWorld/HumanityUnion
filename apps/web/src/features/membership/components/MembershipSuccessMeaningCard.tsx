import { Card } from "../../../design-system/components/Card";
import { SectionHeader } from "../../../design-system/components/SectionHeader";
import { MEMBERSHIP_SUCCESS_MEANING } from "../membership.constants";

export function MembershipSuccessMeaningCard() {
  return (
    <section
      className="membership-success-section"
      aria-labelledby="membership-success-meaning-title"
    >
      <SectionHeader title="What Membership Means" />
      <Card>
        <ul className="membership-success-meaning__list">
          {MEMBERSHIP_SUCCESS_MEANING.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
