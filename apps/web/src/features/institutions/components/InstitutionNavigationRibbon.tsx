"use client";

import { useCallback, type CSSProperties } from "react";

import { CONSTITUTIONAL_ARCHITECTURE_BLOCKS } from "../constants";

export function InstitutionNavigationRibbon() {
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
        <h2 id="institutions-architecture-title">Constitutional Architecture</h2>
        <p className="institutions-architecture__intro">
          A proposed flow from civic participation to public record. Follow the ribbon or select a
          stage to explore related institutions.
        </p>
      </div>

      <div className="institutions-ribbon" role="region" aria-label="Institution navigation ribbon">
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
                {block.label}
              </button>
            ))}
          </div>
        </div>
        <p className="institutions-architecture__sr-only" id="institutions-ribbon-instructions">
          Select a stage to navigate to the related institution section. The ribbon scrolls
          continuously and pauses on hover.
        </p>
        {CONSTITUTIONAL_ARCHITECTURE_BLOCKS.map((block) => (
          <span
            key={block.id}
            id={`institutions-architecture-desc-${block.id}`}
            className="institutions-architecture__sr-only"
          >
            Navigate to related institution section for {block.label}
          </span>
        ))}
      </div>
    </section>
  );
}
