import type { ParticipationPublicStatisticsProjection } from "@hu/types";

import {
  COMMUNITY_STATISTICS_VISITOR_CONCLUSION,
  communityStatisticsContextIntroduction,
} from "../content";
import { ExperienceBlockShell } from "../../global-experience/components/ExperienceBlockShell";
import { GlobalStatisticsEvidence } from "../../global-experience/components/GlobalStatisticsEvidence";

interface CommunityStatisticsSectionProps {
  projection: ParticipationPublicStatisticsProjection;
  communityName: string;
}

export function CommunityStatisticsSection({
  projection,
  communityName,
}: CommunityStatisticsSectionProps) {
  return (
    <ExperienceBlockShell
      id="community-statistics"
      title="Community Statistics"
      architecturalName="Statistics"
      stage="Evidence"
      contextIntroduction={communityStatisticsContextIntroduction(communityName)}
      visitorConclusion={COMMUNITY_STATISTICS_VISITOR_CONCLUSION}
    >
      <GlobalStatisticsEvidence projection={projection} />
    </ExperienceBlockShell>
  );
}
