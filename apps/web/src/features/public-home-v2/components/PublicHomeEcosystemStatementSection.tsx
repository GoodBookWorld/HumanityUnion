import { Button } from "../../../design-system";
import { PUBLIC_HOME_ECOSYSTEM_STATEMENT } from "../constants";

export function PublicHomeEcosystemStatementSection() {
  return (
    <section
      className="public-home-v2__section public-home-v2__ecosystem"
      aria-labelledby="public-home-ecosystem-title"
    >
      <h2 id="public-home-ecosystem-title" className="public-home-v2__visually-hidden">
        Civic ecosystem
      </h2>
      <p className="public-home-v2__ecosystem-primary">{PUBLIC_HOME_ECOSYSTEM_STATEMENT.primary}</p>
      <p className="public-home-v2__ecosystem-supporting">
        {PUBLIC_HOME_ECOSYSTEM_STATEMENT.supporting}
      </p>
      <div className="public-home-v2__section-actions">
        <Button href="/initiatives" variant="primary">
          Create Initiative
        </Button>
        <Button href="/" variant="secondary">
          Explore the World
        </Button>
      </div>
    </section>
  );
}
