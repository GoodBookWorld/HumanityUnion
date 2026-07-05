import { ExperienceBlockShell } from "./ExperienceBlockShell";

interface ExperienceBlockSectionProps {
  id: string;
  title: string;
  architecturalName: string;
  stage: string;
}

export function ExperienceBlockSection({
  id,
  title,
  architecturalName,
  stage,
}: ExperienceBlockSectionProps) {
  return (
    <ExperienceBlockShell
      id={id}
      title={title}
      architecturalName={architecturalName}
      stage={stage}
      contextIntroduction="Context introduction for this block will appear here."
    >
      <p className="experience-block__placeholder">
        Evidence content for {title} will be implemented in a later sprint.
      </p>
    </ExperienceBlockShell>
  );
}
