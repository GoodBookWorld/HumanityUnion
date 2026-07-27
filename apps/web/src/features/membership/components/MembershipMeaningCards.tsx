import { Card } from "../../../design-system/components/Card";
import { SectionHeader } from "../../../design-system/components/SectionHeader";
import { MEMBERSHIP_MEANING_CARDS } from "../membership.constants";

export function MembershipMeaningCards() {
  return (
    <section className="membership-section" aria-labelledby="membership-meaning-title">
      <SectionHeader
        title="Meaning of Membership"
        description="Membership is voluntary support for Humanity Union's civic platform."
      />
      <div className="membership-info-grid">
        {MEMBERSHIP_MEANING_CARDS.map((card) => (
          <Card key={card.id} className="membership-info-card">
            <h3 className="membership-info-card__title">{card.title}</h3>
            <p className="membership-info-card__body">{card.body}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
