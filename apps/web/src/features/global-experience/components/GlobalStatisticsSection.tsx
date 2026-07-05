import type { ParticipationPublicStatisticsProjection } from "@hu/types";

import { GLOBAL_STATISTICS_CONTENT } from "../content";
import { ExperienceBlockShell, ParticipationStatisticsEvidence } from "../../public-experience";

interface GlobalStatisticsSectionProps {
  projection: ParticipationPublicStatisticsProjection;
}

export function GlobalStatisticsSection({ projection }: GlobalStatisticsSectionProps) {
  return (
    <ExperienceBlockShell
      id="global-statistics"
      title={GLOBAL_STATISTICS_CONTENT.title}
      architecturalName="Statistics"
      stage="Evidence"
      contextIntroduction={GLOBAL_STATISTICS_CONTENT.contextIntroduction}
    >
      <ParticipationStatisticsEvidence projection={projection} />
    </ExperienceBlockShell>
  );
}
