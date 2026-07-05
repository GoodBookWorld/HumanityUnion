import type { ParticipationPipelinePublicProjection } from "@hu/types";

import {
  COMMUNITY_PIPELINE_VISITOR_CONCLUSION,
  communityPipelineContextIntroduction,
} from "../content";
import { ExperienceBlockShell, ParticipationPipelineEvidence } from "../../public-experience";

interface CommunityParticipationPipelineSectionProps {
  projection: ParticipationPipelinePublicProjection;
  communityName: string;
}

export function CommunityParticipationPipelineSection({
  projection,
  communityName,
}: CommunityParticipationPipelineSectionProps) {
  return (
    <ExperienceBlockShell
      id="community-participation-pipeline"
      title="Community Participation Pipeline"
      architecturalName="Initiative Levels"
      stage="Evidence"
      contextIntroduction={communityPipelineContextIntroduction(communityName)}
      visitorConclusion={COMMUNITY_PIPELINE_VISITOR_CONCLUSION}
    >
      <ParticipationPipelineEvidence projection={projection} />
    </ExperienceBlockShell>
  );
}
