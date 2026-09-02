"use client";

import { useTranslations } from "next-intl";

import { Card } from "../../../design-system";
import { PUBLIC_HOME_OPPORTUNITIES } from "../constants";

export function PublicHomeOpportunitySection() {
  const t = useTranslations("publicHome");

  return (
    <section className="public-home-v2__section" aria-labelledby="public-home-opportunities-title">
      <h2 id="public-home-opportunities-title">{t("opportunities.sectionTitle")}</h2>
      <div className="public-home-v2__card-grid public-home-v2__card-grid--opportunities">
        {PUBLIC_HOME_OPPORTUNITIES.map((opportunity) => (
          <Card
            key={opportunity.id}
            className="public-home-v2__card public-home-v2__card--interactive"
          >
            <h3>{t(`opportunities.${opportunity.id}.title`)}</h3>
            <p>{t(`opportunities.${opportunity.id}.description`)}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
