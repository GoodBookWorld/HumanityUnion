import type { LatestInitiativesPublicProjection } from "@hu/types";

import {
  REGIONAL_INITIATIVES_EMPTY_MESSAGE,
  REGIONAL_INITIATIVES_VISITOR_CONCLUSION,
  regionalInitiativesContextIntroduction,
} from "../content";
import { ExperienceBlockShell, LatestInitiativesEvidence } from "../../public-experience";

interface LatestRegionalInitiativesSectionProps {
  projection: LatestInitiativesPublicProjection;
  regionName: string;
}

export function LatestRegionalInitiativesSection({
  projection,
  regionName,
}: LatestRegionalInitiativesSectionProps) {
  return (
    <ExperienceBlockShell
      id="latest-regional-initiatives"
      title="Latest Regional Initiatives"
      architecturalName="Latest Initiatives"
      stage="Evidence"
      contextIntroduction={regionalInitiativesContextIntroduction(regionName)}
      visitorConclusion={REGIONAL_INITIATIVES_VISITOR_CONCLUSION}
    >
      <LatestInitiativesEvidence
        projection={projection}
        emptyMessage={REGIONAL_INITIATIVES_EMPTY_MESSAGE}
      />
    </ExperienceBlockShell>
  );
}
