import type { ParticipationPublicStatisticsProjection } from "@hu/types";

import {
  NATIONAL_STATISTICS_PUBLIC_NOTE,
  NATIONAL_STATISTICS_VISITOR_CONCLUSION,
  nationalStatisticsContextIntroduction,
} from "../content";
import { ExperienceBlockShell, ParticipationStatisticsEvidence } from "../../public-experience";

interface NationalStatisticsSectionProps {
  projection: ParticipationPublicStatisticsProjection;
  countryName: string;
}

export function NationalStatisticsSection({
  projection,
  countryName,
}: NationalStatisticsSectionProps) {
  return (
    <ExperienceBlockShell
      id="national-statistics"
      title="National Statistics"
      architecturalName="Statistics"
      stage="Evidence"
      contextIntroduction={nationalStatisticsContextIntroduction(countryName)}
      visitorConclusion={NATIONAL_STATISTICS_VISITOR_CONCLUSION}
    >
      <ParticipationStatisticsEvidence projection={projection} />
      <p className="national-statistics__public-note" role="note">
        {NATIONAL_STATISTICS_PUBLIC_NOTE}
      </p>
    </ExperienceBlockShell>
  );
}
