import type { ParticipationPublicStatisticsProjection } from "@hu/types";

import {
  REGIONAL_STATISTICS_PUBLIC_NOTE,
  REGIONAL_STATISTICS_VISITOR_CONCLUSION,
  regionalStatisticsContextIntroduction,
} from "../content";
import { ExperienceBlockShell, ParticipationStatisticsEvidence } from "../../public-experience";

interface RegionalStatisticsSectionProps {
  projection: ParticipationPublicStatisticsProjection;
  regionName: string;
}

export function RegionalStatisticsSection({
  projection,
  regionName,
}: RegionalStatisticsSectionProps) {
  return (
    <ExperienceBlockShell
      id="regional-statistics"
      title="Regional Statistics"
      architecturalName="Statistics"
      stage="Evidence"
      contextIntroduction={regionalStatisticsContextIntroduction(regionName)}
      visitorConclusion={REGIONAL_STATISTICS_VISITOR_CONCLUSION}
    >
      <ParticipationStatisticsEvidence projection={projection} />
      <p className="regional-statistics__public-note" role="note">
        {REGIONAL_STATISTICS_PUBLIC_NOTE}
      </p>
    </ExperienceBlockShell>
  );
}
