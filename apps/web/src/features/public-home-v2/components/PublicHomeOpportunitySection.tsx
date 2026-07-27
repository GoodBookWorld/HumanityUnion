import { Card } from "../../../design-system";
import { PUBLIC_HOME_OPPORTUNITIES } from "../constants";

export function PublicHomeOpportunitySection() {
  return (
    <section className="public-home-v2__section" aria-labelledby="public-home-opportunities-title">
      <h2 id="public-home-opportunities-title">What can you do here?</h2>
      <div className="public-home-v2__card-grid public-home-v2__card-grid--opportunities">
        {PUBLIC_HOME_OPPORTUNITIES.map((opportunity) => (
          <Card
            key={opportunity.id}
            className="public-home-v2__card public-home-v2__card--interactive"
          >
            <h3>{opportunity.title}</h3>
            <p>{opportunity.description}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
