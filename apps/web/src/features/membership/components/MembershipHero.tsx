import type { MembershipSummary } from "@hu/types";
import { useTranslations } from "next-intl";

import { useLocalizedBrand } from "../../brand-localization/useLocalizedBrand";

import { MembershipCohortBadge } from "./MembershipCohortBadge";
import { MEMBER_BADGE_IMAGE_PATH } from "../membership.constants";

import "./membership-page.css";

interface MembershipHeroProps {
  cohortLabel?: MembershipSummary["cohortLabel"];
}

export function MembershipHero({ cohortLabel = "Participant" }: MembershipHeroProps) {
  const t = useTranslations("membershipPublic");
  const brand = useLocalizedBrand();
  const siteName = { siteName: brand.siteName };

  return (
    <section className="membership-hero" aria-labelledby="membership-hero-title">
      <div className="membership-hero__layout">
        <div className="membership-hero__content">
          <MembershipCohortBadge cohortLabel={cohortLabel} />
          <h1 id="membership-hero-title" className="membership-hero__title">
            {t("hero.title", siteName)}
          </h1>
          <p className="membership-hero__subtitle">{t("hero.subtitle", siteName)}</p>
        </div>
        <div className="membership-hero__illustration-wrap">
          <img
            className="membership-hero__illustration"
            src={MEMBER_BADGE_IMAGE_PATH}
            alt={t("hero.badgeAlt", siteName)}
            width={320}
            height={320}
            loading="lazy"
          />
        </div>
      </div>
    </section>
  );
}
