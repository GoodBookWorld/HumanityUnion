import type { ParticipationPipelinePublicProjection } from "@hu/types";

import {
  NATIONAL_PIPELINE_VISITOR_CONCLUSION,
  nationalPipelineContextIntroduction,
} from "../content";
import { ExperienceBlockShell, ParticipationPipelineEvidence } from "../../public-experience";

interface NationalParticipationPipelineSectionProps {
  projection: ParticipationPipelinePublicProjection;
  countryName: string;
}

export function NationalParticipationPipelineSection({
  projection,
  countryName,
}: NationalParticipationPipelineSectionProps) {
  return (
    <ExperienceBlockShell
      id="national-participation-pipeline"
      title="National Participation Pipeline"
      architecturalName="Initiative Levels"
      stage="Evidence"
      contextIntroduction={nationalPipelineContextIntroduction(countryName)}
      visitorConclusion={NATIONAL_PIPELINE_VISITOR_CONCLUSION}
    >
      <ParticipationPipelineEvidence projection={projection} />
    </ExperienceBlockShell>
  );
}
