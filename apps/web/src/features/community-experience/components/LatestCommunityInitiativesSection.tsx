import type { LatestInitiativesPublicProjection } from "@hu/types";

import {
  COMMUNITY_INITIATIVES_EMPTY_MESSAGE,
  COMMUNITY_INITIATIVES_VISITOR_CONCLUSION,
  communityInitiativesContextIntroduction,
} from "../content";
import { ExperienceBlockShell, LatestInitiativesEvidence } from "../../public-experience";

interface LatestCommunityInitiativesSectionProps {
  projection: LatestInitiativesPublicProjection;
  communityName: string;
}

export function LatestCommunityInitiativesSection({
  projection,
  communityName,
}: LatestCommunityInitiativesSectionProps) {
  return (
    <ExperienceBlockShell
      id="latest-community-initiatives"
      title="Latest Community Initiatives"
      architecturalName="Latest Initiatives"
      stage="Evidence"
      contextIntroduction={communityInitiativesContextIntroduction(communityName)}
      visitorConclusion={COMMUNITY_INITIATIVES_VISITOR_CONCLUSION}
    >
      <LatestInitiativesEvidence
        projection={projection}
        emptyMessage={COMMUNITY_INITIATIVES_EMPTY_MESSAGE}
      />
    </ExperienceBlockShell>
  );
}
