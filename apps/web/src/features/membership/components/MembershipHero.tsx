import type { MembershipSummary } from "@hu/types";
import { useTranslations } from "next-intl";

import { MembershipCohortBadge } from "./MembershipCohortBadge";
import { MEMBER_BADGE_IMAGE_PATH } from "../membership.constants";

import "./membership-page.css";

interface MembershipHeroProps {
  cohortLabel?: MembershipSummary["cohortLabel"];
}

export function MembershipHero({ cohortLabel = "Participant" }: MembershipHeroProps) {
  const t = useTranslations("membershipPublic");

  return (
    <section className="membership-hero" aria-labelledby="membership-hero-title">
      <div className="membership-hero__layout">
        <div className="membership-hero__content">
          <MembershipCohortBadge cohortLabel={cohortLabel} />
          <h1 id="membership-hero-title" className="membership-hero__title">
            {t("hero.title")}
          </h1>
          <p className="membership-hero__subtitle">{t("hero.subtitle")}</p>
        </div>
        <div className="membership-hero__illustration-wrap">
          <img
            className="membership-hero__illustration"
            src={MEMBER_BADGE_IMAGE_PATH}
            alt={t("hero.badgeAlt")}
            width={320}
            height={320}
            loading="lazy"
          />
        </div>
      </div>
    </section>
  );
}
