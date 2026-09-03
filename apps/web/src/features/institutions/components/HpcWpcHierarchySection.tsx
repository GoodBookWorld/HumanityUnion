"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

import { useLocalizedBrand } from "../../brand-localization/useLocalizedBrand";

import { PROTECTION_HIERARCHY_LEVELS } from "../constants";
import { InstitutionHeroIllustration } from "./InstitutionIllustration";

export function HpcWpcHierarchySection() {
  const t = useTranslations("institutionsPublic");
  const brand = useLocalizedBrand();
  const siteName = { siteName: brand.siteName };

  const scrollToTarget = useCallback((targetId: string) => {
    const element = document.getElementById(targetId);
    element?.scrollIntoView({ behavior: "smooth", block: "start" });
    element?.focus({ preventScroll: true });
  }, []);

  return (
    <section
      className="institutions-hierarchy institutions-section institutions-section--white"
      aria-labelledby="institutions-hierarchy-title"
      id="institutions-protection"
    >
      <div className="institutions-section__inner">
        <h2 id="institutions-hierarchy-title">{t("hierarchy.title")}</h2>
        <p className="institutions-hierarchy__intro">{t("hierarchy.intro")}</p>

        <div className="institutions-hierarchy__flow" aria-label={t("hierarchy.flowAria")}>
          {PROTECTION_HIERARCHY_LEVELS.map((level, index) => {
            const isLast = index === PROTECTION_HIERARCHY_LEVELS.length - 1;

            if (level.kind === "hero") {
              return (
                <div key={level.id} className="institutions-hierarchy__step">
                  <article className="institutions-hierarchy__node" id="institution-hpc">
                    <InstitutionHeroIllustration
                      illustrationId={level.illustrationId}
                      title={t(`hierarchy.levels.${level.id}.title`, siteName)}
                      subtitle={t(`hierarchy.levels.${level.id}.subtitle`)}
                    />
                  </article>
                  {!isLast ? (
                    <div className="institutions-hierarchy__connector" aria-hidden="true">
                      <span className="institutions-hierarchy__arrow">↓</span>
                    </div>
                  ) : null}
                </div>
              );
            }

            if (level.kind === "connector") {
              return (
                <div key={level.id} className="institutions-hierarchy__step">
                  <div
                    className="institutions-hierarchy__connector institutions-hierarchy__connector--labelled"
                    aria-hidden="true"
                  >
                    <span className="institutions-hierarchy__arrow">↓</span>
                    <span className="institutions-hierarchy__command-label">
                      {t(`hierarchy.levels.${level.id}.label`)}
                    </span>
                    <span className="institutions-hierarchy__arrow">↓</span>
                  </div>
                </div>
              );
            }

            const levelTitle = t(`hierarchy.levels.${level.id}.title`, siteName);

            return (
              <div key={level.id} className="institutions-hierarchy__step">
                <button
                  type="button"
                  className="institutions-hierarchy__link-node"
                  onClick={() => scrollToTarget(level.targetId)}
                  aria-label={t("hierarchy.navigateTo", { title: levelTitle })}
                >
                  <h3>{levelTitle}</h3>
                  <p>{t(`hierarchy.levels.${level.id}.description`, siteName)}</p>
                </button>
                {!isLast ? (
                  <div className="institutions-hierarchy__connector" aria-hidden="true">
                    <span className="institutions-hierarchy__arrow">↓</span>
                    {level.id === "wpc" ? (
                      <span className="institutions-hierarchy__command-label">
                        {t("hierarchy.commands")}
                      </span>
                    ) : null}
                    <span className="institutions-hierarchy__arrow">↓</span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
