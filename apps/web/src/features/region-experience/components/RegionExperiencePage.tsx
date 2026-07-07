import type { RegionExperiencePublicProjections } from "@hu/types";

import { RegistrationGatewaySection } from "../../public-experience";
import { CommunityDiscoverySection } from "./CommunityDiscoverySection";
import { LatestRegionalInitiativesSection } from "./LatestRegionalInitiativesSection";
import { RegionGeographicNavigator } from "./RegionGeographicNavigator";
import { RegionIdentitySection } from "./RegionIdentitySection";
import { RegionalInteractiveMapSection } from "./RegionalInteractiveMapSection";
import { RegionalParticipationPipelineSection } from "./RegionalParticipationPipelineSection";
import { RegionalStatisticsSection } from "./RegionalStatisticsSection";

interface RegionExperiencePageProps {
  projections: RegionExperiencePublicProjections;
}

export function RegionExperiencePage({ projections }: RegionExperiencePageProps) {
  const { identity, statistics, pipeline, latestInitiatives, communityCatalog } = projections;

  return (
    <div className="region-experience-page">
      <a href="#main-content" className="region-experience-page__skip-link">
        Skip to main content
      </a>
      <RegionGeographicNavigator identity={identity} />

      <main className="region-experience-page__main" id="main-content">
        <div className="region-experience-page__content">
          <RegionIdentitySection identity={identity} />
          <RegionalInteractiveMapSection />
          <RegionalStatisticsSection projection={statistics} regionName={identity.name} />
          <RegionalParticipationPipelineSection projection={pipeline} regionName={identity.name} />
          <LatestRegionalInitiativesSection
            projection={latestInitiatives}
            regionName={identity.name}
          />
          <CommunityDiscoverySection catalog={communityCatalog} regionName={identity.name} />
          <RegistrationGatewaySection />
        </div>
      </main>
    </div>
  );
}
