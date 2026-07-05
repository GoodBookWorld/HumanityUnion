import type { ParticipationPipelinePublicProjection } from "@hu/types";

import {
  REGIONAL_PIPELINE_VISITOR_CONCLUSION,
  regionalPipelineContextIntroduction,
} from "../content";
import { ExperienceBlockShell, ParticipationPipelineEvidence } from "../../public-experience";

interface RegionalParticipationPipelineSectionProps {
  projection: ParticipationPipelinePublicProjection;
  regionName: string;
}

export function RegionalParticipationPipelineSection({
  projection,
  regionName,
}: RegionalParticipationPipelineSectionProps) {
  return (
    <ExperienceBlockShell
      id="regional-participation-pipeline"
      title="Regional Participation Pipeline"
      architecturalName="Initiative Levels"
      stage="Evidence"
      contextIntroduction={regionalPipelineContextIntroduction(regionName)}
      visitorConclusion={REGIONAL_PIPELINE_VISITOR_CONCLUSION}
    >
      <ParticipationPipelineEvidence projection={projection} />
    </ExperienceBlockShell>
  );
}
