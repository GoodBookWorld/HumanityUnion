"use client";

import { useTranslations } from "next-intl";

import { Button } from "../../../design-system";
import { PUBLIC_HOME_HERO } from "../constants";
import { PublicHomeCreateInitiativeCta } from "./PublicHomeCreateInitiativeCta";
import { HumanityUnityVisual } from "./HumanityUnityVisual";

export function PublicHomeHeroSection() {
  const t = useTranslations("publicHome");

  return (
    <section
      className="public-home-v2__section public-home-v2__hero"
      aria-labelledby="public-home-hero-title"
    >
      <div className="public-home-v2__hero-layout">
        <div className="public-home-v2__hero-content">
          <h1 id="public-home-hero-title" className="public-home-v2__hero-title">
            {t("headline")}
          </h1>
          <p className="public-home-v2__hero-subtitle">{t("subheadline")}</p>
          <div className="public-home-v2__hero-actions">
            <PublicHomeCreateInitiativeCta label={t("primaryCta")} />
            <Button href={PUBLIC_HOME_HERO.secondaryCta.href} variant="secondary">
              {t("secondaryCta")}
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
