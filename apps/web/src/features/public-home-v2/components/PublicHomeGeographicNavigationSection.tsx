"use client";

import { useTranslations } from "next-intl";

import { ApproximateIpGeographicNavigator } from "./ApproximateIpGeographicNavigator";
import { InteractiveWorldMap } from "../../world-map/components/InteractiveWorldMap";

import "./public-home-geographic-navigation.css";

export function PublicHomeGeographicNavigationSection() {
  const t = useTranslations("publicHome");

  return (
    <section
      className="public-home-v2__section public-home-v2__geographic-navigation"
      aria-labelledby="public-home-geographic-navigation-title"
    >
      <h2 id="public-home-geographic-navigation-title">{t("geographic.title")}</h2>
      <p className="public-home-v2__section-intro">{t("geographic.intro")}</p>
      <ApproximateIpGeographicNavigator />
      <div className="public-home-v2__world-map">
        <InteractiveWorldMap />
      </div>
    </section>
  );
}
