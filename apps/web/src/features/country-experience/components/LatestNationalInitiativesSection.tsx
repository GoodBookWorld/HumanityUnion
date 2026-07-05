import type { LatestInitiativesPublicProjection } from "@hu/types";

import {
  NATIONAL_INITIATIVES_EMPTY_MESSAGE,
  NATIONAL_INITIATIVES_VISITOR_CONCLUSION,
  nationalInitiativesContextIntroduction,
} from "../content";
import { ExperienceBlockShell, LatestInitiativesEvidence } from "../../public-experience";

interface LatestNationalInitiativesSectionProps {
  projection: LatestInitiativesPublicProjection;
  countryName: string;
}

export function LatestNationalInitiativesSection({
  projection,
  countryName,
}: LatestNationalInitiativesSectionProps) {
  return (
    <ExperienceBlockShell
      id="latest-national-initiatives"
      title="Latest National Initiatives"
      architecturalName="Latest Initiatives"
      stage="Evidence"
      contextIntroduction={nationalInitiativesContextIntroduction(countryName)}
      visitorConclusion={NATIONAL_INITIATIVES_VISITOR_CONCLUSION}
    >
      <LatestInitiativesEvidence
        projection={projection}
        emptyMessage={NATIONAL_INITIATIVES_EMPTY_MESSAGE}
      />
    </ExperienceBlockShell>
  );
}
