"use client";

import { useTranslations } from "next-intl";

import { Button } from "../../../design-system";
import { PwaInstallPromotion } from "../../pwa/components/PwaInstallPromotion";

/**
 * Geometry Convergence Pack 03 + PWA Pack 01 — one ecosystem section with a
 * responsive 50/50 split (Ecosystem | Humanity Union App). No nested section.
 */
export function PublicHomeEcosystemStatementSection() {
  const t = useTranslations("publicHome");

  return (
    <section
      className="public-home-v2__section public-home-v2__ecosystem"
      aria-labelledby="public-home-ecosystem-title"
    >
      <h2 id="public-home-ecosystem-title" className="public-home-v2__visually-hidden">
        {t("ecosystem.sectionTitle")}
      </h2>
      <div className="public-home-v2__ecosystem-split">
        <div className="public-home-v2__ecosystem-column">
          <p className="public-home-v2__ecosystem-primary">{t("ecosystem.primary")}</p>
          <p className="public-home-v2__ecosystem-supporting">{t("ecosystem.supporting")}</p>
          <div className="public-home-v2__section-actions">
            <Button href="/initiatives" variant="primary">
              {t("ecosystem.createInitiative")}
            </Button>
            <Button href="/" variant="secondary">
              {t("ecosystem.exploreWorld")}
            </Button>
          </div>
        </div>
        <PwaInstallPromotion />
      </div>
    </section>
  );
}
