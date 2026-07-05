import type { CommunityCatalogPublicProjection } from "@hu/types";

import { COMMUNITY_DISCOVERY_CONTENT } from "../content";
import { ExperienceBlockShell } from "../../public-experience";
import { CommunityDiscoveryEvidence } from "./CommunityDiscoveryEvidence";

interface CommunityDiscoverySectionProps {
  catalog: CommunityCatalogPublicProjection;
  regionName: string;
}

export function CommunityDiscoverySection({ catalog, regionName }: CommunityDiscoverySectionProps) {
  return (
    <ExperienceBlockShell
      id="community-discovery"
      title={COMMUNITY_DISCOVERY_CONTENT.title}
      architecturalName="Exploration"
      stage="Exploration"
      contextIntroduction={COMMUNITY_DISCOVERY_CONTENT.contextIntroduction}
      visitorConclusion={COMMUNITY_DISCOVERY_CONTENT.visitorConclusion}
    >
      <CommunityDiscoveryEvidence catalog={catalog} regionName={regionName} />
    </ExperienceBlockShell>
  );
}
