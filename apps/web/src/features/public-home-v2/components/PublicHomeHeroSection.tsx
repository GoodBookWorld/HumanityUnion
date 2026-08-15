import { Button } from "../../../design-system";
import { PUBLIC_HOME_HERO } from "../constants";
import { PublicHomeCreateInitiativeCta } from "./PublicHomeCreateInitiativeCta";
import { HumanityUnityVisual } from "./HumanityUnityVisual";

export function PublicHomeHeroSection() {
  return (
    <section
      className="public-home-v2__section public-home-v2__hero"
      aria-labelledby="public-home-hero-title"
    >
      <div className="public-home-v2__hero-layout">
        <div className="public-home-v2__hero-content">
          <h1 id="public-home-hero-title" className="public-home-v2__hero-title">
            {PUBLIC_HOME_HERO.headline}
          </h1>
          <p className="public-home-v2__hero-subtitle">{PUBLIC_HOME_HERO.subheadline}</p>
          <div className="public-home-v2__hero-actions">
            <PublicHomeCreateInitiativeCta label={PUBLIC_HOME_HERO.primaryCta.label} />
            <Button href={PUBLIC_HOME_HERO.secondaryCta.href} variant="secondary">
              {PUBLIC_HOME_HERO.secondaryCta.label}
            </Button>
          </div>
        </div>
        <div className="public-home-v2__hero-visual">
          <HumanityUnityVisual />
        </div>
      </div>
    </section>
  );
}
