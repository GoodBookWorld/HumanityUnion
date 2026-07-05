import type { LatestInitiativesPublicProjection } from "@hu/types";

import { ExperienceBlockShell, LatestInitiativesEvidence } from "../../public-experience";
import { LATEST_GLOBAL_INITIATIVES_CONTENT } from "../content";

interface LatestGlobalInitiativesSectionProps {
  projection: LatestInitiativesPublicProjection;
}

export function LatestGlobalInitiativesSection({
  projection,
}: LatestGlobalInitiativesSectionProps) {
  return (
    <ExperienceBlockShell
      id="latest-global-initiatives"
      title={LATEST_GLOBAL_INITIATIVES_CONTENT.title}
      architecturalName="Latest Initiatives"
      stage="Evidence"
      contextIntroduction={LATEST_GLOBAL_INITIATIVES_CONTENT.contextIntroduction}
      visitorConclusion={LATEST_GLOBAL_INITIATIVES_CONTENT.visitorConclusion}
    >
      <LatestInitiativesEvidence
        projection={projection}
        emptyMessage={LATEST_GLOBAL_INITIATIVES_CONTENT.emptyMessage}
      />
    </ExperienceBlockShell>
  );
}
