import type { ParticipationPipelinePublicProjection } from "@hu/types";

import { PARTICIPATION_PIPELINE_CONTENT } from "../content";
import { ExperienceBlockShell, ParticipationPipelineEvidence } from "../../public-experience";

interface ParticipationPipelineSectionProps {
  projection: ParticipationPipelinePublicProjection;
}

export function ParticipationPipelineSection({ projection }: ParticipationPipelineSectionProps) {
  return (
    <ExperienceBlockShell
      id="participation-pipeline"
      title={PARTICIPATION_PIPELINE_CONTENT.title}
      architecturalName="Initiative Levels"
      stage="Evidence"
      contextIntroduction={PARTICIPATION_PIPELINE_CONTENT.contextIntroduction}
    >
      <ParticipationPipelineEvidence projection={projection} />
    </ExperienceBlockShell>
  );
}
