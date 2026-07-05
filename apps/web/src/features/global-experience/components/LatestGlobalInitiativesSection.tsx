import type { LatestInitiativesPublicProjection } from "@hu/types";

import { LATEST_GLOBAL_INITIATIVES_CONTENT } from "../content";
import { ExperienceBlockShell } from "./ExperienceBlockShell";
import { LatestGlobalInitiativesEvidence } from "./LatestGlobalInitiativesEvidence";

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
      <LatestGlobalInitiativesEvidence projection={projection} />
    </ExperienceBlockShell>
  );
}
