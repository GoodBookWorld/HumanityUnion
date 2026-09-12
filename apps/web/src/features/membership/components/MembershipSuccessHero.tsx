"use client";

import { useTranslations } from "next-intl";

import { useLocalizedBrand } from "../../brand-localization/useLocalizedBrand";

import { MemberBadgeIcon } from "./MemberBadgeIcon";

const SUCCESS_MEANING_POINT_IDS = [
  "support",
  "equal",
  "vote",
  "profile",
  "community",
] as const;

export function MembershipSuccessHero() {
  const t = useTranslations("membershipPublic.successPage");
  const brand = useLocalizedBrand();

  return (
    <section className="membership-success-hero" aria-labelledby="membership-success-hero-title">
      <div className="membership-success-hero__content">
        <p className="membership-success-hero__eyebrow">{t("eyebrow")}</p>
        <h1 id="membership-success-hero-title" className="membership-success-hero__title">
          {t("heading")}
        </h1>
        <p className="membership-success-hero__subheading">{t("subheading")}</p>
        <p className="membership-success-hero__body">
          {t("body", { siteName: brand.siteName })}
        </p>
      </div>
      <div className="membership-success-hero__artwork" aria-hidden="true">
        <div className="membership-success-hero__glow" />
        <MemberBadgeIcon size="feature" decorative />
      </div>
    </section>
  );
}

export { SUCCESS_MEANING_POINT_IDS };
