"use client";

import { useCallback } from "react";

import { PROTECTION_HIERARCHY_LEVELS } from "../constants";
import { InstitutionHeroIllustration } from "./InstitutionIllustration";

export function HpcWpcHierarchySection() {
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
        <h2 id="institutions-hierarchy-title">Protection Command Structure</h2>
        <p className="institutions-hierarchy__intro">
          The proposed Humanity Protection Command Center (HPC) is designed to coordinate protective
          policy and direct World Protection Corps (WPC) operations within defined oversight limits.
        </p>

        <div
          className="institutions-hierarchy__flow"
          aria-label="Protection hierarchy from HPC through regional and community coordination"
        >
          {PROTECTION_HIERARCHY_LEVELS.map((level, index) => {
            const isLast = index === PROTECTION_HIERARCHY_LEVELS.length - 1;

            if (level.kind === "hero") {
              return (
                <div key={level.id} className="institutions-hierarchy__step">
                  <article className="institutions-hierarchy__node" id="institution-hpc">
                    <InstitutionHeroIllustration
                      illustrationId={level.illustrationId}
                      title={level.title}
                      subtitle={level.subtitle}
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
                    <span className="institutions-hierarchy__command-label">{level.label}</span>
                    <span className="institutions-hierarchy__arrow">↓</span>
                  </div>
                </div>
              );
            }

            return (
              <div key={level.id} className="institutions-hierarchy__step">
                <button
                  type="button"
                  className="institutions-hierarchy__link-node"
                  onClick={() => scrollToTarget(level.targetId)}
                  aria-label={`Navigate to ${level.title}`}
                >
                  <h3>{level.title}</h3>
                  <p>{level.description}</p>
                </button>
                {!isLast ? (
                  <div className="institutions-hierarchy__connector" aria-hidden="true">
                    <span className="institutions-hierarchy__arrow">↓</span>
                    {level.id === "wpc" ? (
                      <span className="institutions-hierarchy__command-label">commands</span>
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
