import { Button } from "../../../design-system/components/Button";
import { Card } from "../../../design-system/components/Card";

import "./public-initiatives-landing.css";

export function PublicInitiativesLanding() {
  return (
    <section className="public-initiatives-landing" aria-labelledby="public-initiatives-heading">
      <Card>
        <h1 id="public-initiatives-heading">Initiatives</h1>
        <p className="public-initiatives-landing__message">
          To browse initiatives, use Search. To create an initiative, log in or create an account.
        </p>
        <div className="public-initiatives-landing__actions">
          <Button href="/login?returnTo=%2Finitiatives" variant="primary">
            Log in
          </Button>
          <Button href="/register">Create account</Button>
          <Button href="/search?entityType=initiative">Search</Button>
        </div>
        <p className="public-initiatives-landing__hint">
          Member workspace tools appear here after you sign in.
        </p>
      </Card>
    </section>
  );
}
