"use client";

import { useCallback, type CSSProperties } from "react";
import { useTranslations } from "next-intl";

import { CONSTITUTIONAL_ARCHITECTURE_BLOCKS } from "../constants";

export function InstitutionNavigationRibbon() {
  const t = useTranslations("institutionsPublic");

  const scrollToTarget = useCallback((targetId: string) => {
    const element = document.getElementById(targetId);
    element?.scrollIntoView({ behavior: "smooth", block: "start" });
    element?.focus({ preventScroll: true });
  }, []);

  const ribbonItems = [
    ...CONSTITUTIONAL_ARCHITECTURE_BLOCKS,
    ...CONSTITUTIONAL_ARCHITECTURE_BLOCKS,
  ];

  return (
    <section
      id="institutions-architecture"
      className="institutions-architecture institutions-section institutions-section--white"
      aria-labelledby="institutions-architecture-title"
    >
      <div className="institutions-section__inner">
        <h2 id="institutions-architecture-title">{t("architecture.title")}</h2>
        <p className="institutions-architecture__intro">{t("architecture.intro")}</p>
      </div>

      <div className="institutions-ribbon" role="region" aria-label={t("architecture.ribbonAria")}>
        <div className="institutions-ribbon__viewport">
          <div className="institutions-ribbon__track">
            {ribbonItems.map((block, index) => (
              <button
                key={`${block.id}-${index}`}
                type="button"
                className="institutions-architecture__block institutions-ribbon__item"
                style={{ "--institutions-ribbon-accent": block.accent } as CSSProperties}
                onClick={() => scrollToTarget(block.targetId)}
                aria-describedby={`institutions-architecture-desc-${block.id}`}
              >
                {t(`architecture.blocks.${block.id}`)}
              </button>
            ))}
          </div>
        </div>
        <p className="institutions-architecture__sr-only" id="institutions-ribbon-instructions">
          {t("architecture.ribbonInstructions")}
        </p>
        {CONSTITUTIONAL_ARCHITECTURE_BLOCKS.map((block) => (
          <span
            key={block.id}
            id={`institutions-architecture-desc-${block.id}`}
            className="institutions-architecture__sr-only"
          >
            {t("architecture.navigateTo", { label: t(`architecture.blocks.${block.id}`) })}
          </span>
        ))}
      </div>
    </section>
  );
}
