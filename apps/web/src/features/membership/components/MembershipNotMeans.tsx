import { Card } from "../../../design-system/components/Card";
import { SectionHeader } from "../../../design-system/components/SectionHeader";
import { MEMBERSHIP_NOT_MEANS } from "../membership.constants";

export function MembershipNotMeans() {
  return (
    <section className="membership-section" aria-labelledby="membership-not-means-title">
      <SectionHeader
        title="What Membership Does NOT Mean"
        description="Membership is civic support — not authority, identity, or privilege."
      />
      <div className="membership-info-grid membership-info-grid--neutral">
        {MEMBERSHIP_NOT_MEANS.map((item) => (
          <Card key={item} className="membership-info-card membership-info-card--neutral">
            <p className="membership-info-card__body">Membership is NOT {item}.</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
