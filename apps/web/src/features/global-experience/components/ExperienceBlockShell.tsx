import type { ReactNode } from "react";

interface ExperienceBlockShellProps {
  id: string;
  title: string;
  architecturalName: string;
  stage: string;
  contextIntroduction: string;
  visitorConclusion?: string;
  headingLevel?: "h1" | "h2";
  children: ReactNode;
}

export function ExperienceBlockShell({
  id,
  title,
  architecturalName,
  stage,
  contextIntroduction,
  visitorConclusion,
  headingLevel = "h2",
  children,
}: ExperienceBlockShellProps) {
  const HeadingTag = headingLevel;

  return (
    <section
      id={id}
      className="experience-block"
      aria-labelledby={`${id}-heading`}
      data-block={architecturalName}
      data-stage={stage}
    >
      <div className="experience-block__inner">
        <HeadingTag id={`${id}-heading`} className="experience-block__heading">
          {title}
        </HeadingTag>
        <p className="experience-block__context">{contextIntroduction}</p>
        <div className="experience-block__evidence">{children}</div>
        {visitorConclusion ? (
          <p className="experience-block__conclusion">{visitorConclusion}</p>
        ) : null}
      </div>
    </section>
  );
}
