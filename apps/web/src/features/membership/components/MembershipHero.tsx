import type { MembershipSummary } from "@hu/types";

import { MembershipCohortBadge } from "./MembershipCohortBadge";
import { MEMBER_BADGE_IMAGE_PATH, MEMBERSHIP_HERO } from "../membership.constants";

import "./membership-page.css";

interface MembershipHeroProps {
  cohortLabel?: MembershipSummary["cohortLabel"];
}

export function MembershipHero({ cohortLabel = "Participant" }: MembershipHeroProps) {
  return (
    <section className="membership-hero" aria-labelledby="membership-hero-title">
      <div className="membership-hero__layout">
        <div className="membership-hero__content">
          <MembershipCohortBadge cohortLabel={cohortLabel} />
          <h1 id="membership-hero-title" className="membership-hero__title">
            {MEMBERSHIP_HERO.title}
          </h1>
          <p className="membership-hero__subtitle">{MEMBERSHIP_HERO.subtitle}</p>
        </div>
        <div className="membership-hero__illustration-wrap">
          <img
            className="membership-hero__illustration"
            src={MEMBER_BADGE_IMAGE_PATH}
            alt="Humanity Union Member badge illustration"
            width={320}
            height={320}
            loading="lazy"
          />
        </div>
      </div>
    </section>
  );
}
