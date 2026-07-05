import type { ParticipationPublicStatisticsProjection } from "@hu/types";

import {
  COMMUNITY_STATISTICS_PUBLIC_NOTE,
  COMMUNITY_STATISTICS_VISITOR_CONCLUSION,
  communityStatisticsContextIntroduction,
} from "../content";
import { ExperienceBlockShell, ParticipationStatisticsEvidence } from "../../public-experience";

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
      <ParticipationStatisticsEvidence projection={projection} />
      <p className="community-statistics__public-note" role="note">
        {COMMUNITY_STATISTICS_PUBLIC_NOTE}
      </p>
    </ExperienceBlockShell>
  );
}
