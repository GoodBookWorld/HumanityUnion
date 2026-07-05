import { CIVIC_INTRODUCTION_CONTENT } from "../content";
import { ExperienceBlockShell } from "./ExperienceBlockShell";

export function CivicIntroductionSection() {
  return (
    <ExperienceBlockShell
      id="civic-introduction"
      title={CIVIC_INTRODUCTION_CONTENT.title}
      architecturalName="Hero"
      stage="Identity"
      contextIntroduction={CIVIC_INTRODUCTION_CONTENT.contextIntroduction}
      headingLevel="h1"
    >
      <div className="civic-introduction">
        <p className="civic-introduction__scope">{CIVIC_INTRODUCTION_CONTENT.scopeLabel}</p>
        <p className="civic-introduction__purpose">
          {CIVIC_INTRODUCTION_CONTENT.observationPurpose}
        </p>
        <p className="civic-introduction__about">
          <span
            className="civic-introduction__about-placeholder"
            aria-disabled="true"
            title="About — coming soon"
          >
            Learn about Humanity Union
            <span className="civic-introduction__about-note"> (coming soon)</span>
          </span>
        </p>
      </div>
    </ExperienceBlockShell>
  );
}
