"use client";

import { useTranslations } from "next-intl";

import { Card } from "../../../design-system";

export function PublicHomeWorldMapPlaceholderSection() {
  const t = useTranslations("publicHome");

  return (
    <section
      className="public-home-v2__section public-home-v2__map-placeholder"
      aria-labelledby="public-home-map-title"
    >
      <Card className="public-home-v2__card public-home-v2__map-card">
        <h2 id="public-home-map-title">{t("worldMap.title")}</h2>
        <p>{t("worldMap.description")}</p>
        <div className="public-home-v2__map-frame" aria-hidden="true" />
      </Card>
    </section>
  );
}
