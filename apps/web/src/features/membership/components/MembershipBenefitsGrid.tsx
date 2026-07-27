import { Card } from "../../../design-system/components/Card";
import { SectionHeader } from "../../../design-system/components/SectionHeader";
import { MEMBERSHIP_BENEFITS } from "../membership.constants";

export function MembershipBenefitsGrid() {
  return (
    <section className="membership-section" aria-labelledby="membership-benefits-title">
      <SectionHeader
        title="Membership Benefits"
        description="What Membership offers today and in future platform updates."
      />
      <div className="membership-benefits-grid">
        {MEMBERSHIP_BENEFITS.map((benefit) => (
          <Card key={benefit.id} className="membership-benefits-grid__item">
            <h3 className="membership-info-card__title">{benefit.title}</h3>
            <p className="membership-info-card__body">{benefit.body}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
