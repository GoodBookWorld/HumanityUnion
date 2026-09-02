"use client";

import { useTranslations } from "next-intl";

import { Button } from "../../../design-system";
import { PublicHomeCreateInitiativeCta } from "../../public-home-v2/components/PublicHomeCreateInitiativeCta";
import { INSTITUTIONS_FOOTER } from "../constants";
import { STANDARD_INSTITUTION_CARDS } from "../content";
import { HpcWpcHierarchySection } from "./HpcWpcHierarchySection";
import { InstitutionCard } from "./InstitutionCard";
import { InstitutionNavigationRibbon } from "./InstitutionNavigationRibbon";
import { InstitutionsLatestInitiativesSection } from "./InstitutionsLatestInitiativesSection";
import { InstitutionsStickyNav } from "./InstitutionsStickyNav";
import { WpcFeaturedCard } from "./WpcFeaturedCard";

import "../institutions.css";

const GRID_BEFORE_WPC = STANDARD_INSTITUTION_CARDS.filter((record) =>
  [
    "humanity-council",
    "chamber-of-state-representatives",
    "chamber-of-intellectual-analysis",
    "expert-analysis-team",
    "state-collaboration-department",
    "hpc",
  ].includes(record.id),
);

const SECRETARIAT_INSTITUTION = STANDARD_INSTITUTION_CARDS.find((record) => record.id === "secretariat");

const GRID_AFTER_WPC = STANDARD_INSTITUTION_CARDS.filter((record) =>
  ["community-self-defense-units", "regional-offices"].includes(record.id),
);

export function InstitutionsPageContent() {
  const t = useTranslations("institutionsPublic");

  return (
    <main className="institutions-page">
      <section
        className="institutions-hero institutions-section institutions-section--hero"
        aria-labelledby="institutions-hero-title"
      >
        <div className="institutions-section__inner">
          <h1 id="institutions-hero-title">{t("headline")}</h1>
          <p className="institutions-hero__subheadline">{t("subheadline")}</p>
          <div className="institutions-hero__banner" role="note">
            <p>{t("banner")}</p>
          </div>
          <div className="institutions-hero__actions">
            <PublicHomeCreateInitiativeCta label={t("primaryCta")} />
          </div>
        </div>
      </section>

      <InstitutionsStickyNav />
      <InstitutionNavigationRibbon />

      <section
        id="institutions-grid-section"
        className="institutions-grid-section institutions-section institutions-section--institutions"
        aria-labelledby="institutions-grid-title"
      >
        <div className="institutions-section__inner">
          <h2 id="institutions-grid-title">{t("gridTitle")}</h2>
          <p className="institutions-grid-section__intro">{t("gridIntro")}</p>

          <div className="institutions-grid">
            {GRID_BEFORE_WPC.map((institution) => (
              <InstitutionCard key={institution.id} institution={institution} />
            ))}
            {SECRETARIAT_INSTITUTION ? (
              <InstitutionCard institution={SECRETARIAT_INSTITUTION} layout="featured" />
            ) : null}
          </div>
        </div>
      </section>

      <HpcWpcHierarchySection />
      <WpcFeaturedCard />

      <section
        id="regional-offices"
        className="institutions-grid-section institutions-section institutions-section--regional"
        aria-labelledby="institutions-regional-title"
      >
        <div className="institutions-section__inner">
          <h2 id="institutions-regional-title">{t("regionalTitle")}</h2>
          <div className="institutions-grid institutions-grid--after-wpc">
            {GRID_AFTER_WPC.map((institution) => (
              <InstitutionCard key={institution.id} institution={institution} />
            ))}
          </div>
        </div>
      </section>

      <InstitutionsLatestInitiativesSection />

      <section
        className="institutions-footer-statement institutions-section institutions-section--white"
        aria-labelledby="institutions-footer-title"
      >
        <div className="institutions-section__inner">
          <h2 id="institutions-footer-title" className="institutions-footer-statement__sr-only">
            {t("footerClosingAria")}
          </h2>
          <p className="institutions-footer-statement__line">{t("footerStatementLine1")}</p>
          <p className="institutions-footer-statement__line">{t("footerStatementLine2")}</p>
          <div className="institutions-footer-statement__actions">
            <Button href={INSTITUTIONS_FOOTER.primaryCta.href} variant="primary">
              {t("footerPrimaryCta")}
            </Button>
            <Button href={INSTITUTIONS_FOOTER.secondaryCta.href} variant="secondary">
              {t("footerSecondaryCta")}
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
