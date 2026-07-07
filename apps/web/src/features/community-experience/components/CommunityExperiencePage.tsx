import type { CommunityExperiencePublicProjections } from "@hu/types";

import {
  loadCommunityExperiencePageData,
  type CommunityExperiencePageData,
} from "../../public-projection-engine";
import { CommunityGeographicNavigator } from "./CommunityGeographicNavigator";
import { CommunityIdentitySection } from "./CommunityIdentitySection";
import { CommunityImpactOverviewSection } from "./CommunityImpactOverviewSection";
import { CommunityParticipationPipelineSection } from "./CommunityParticipationPipelineSection";
import { CommunityStatisticsSection } from "./CommunityStatisticsSection";
import { FindYourCommunitySection } from "./FindYourCommunitySection";
import { LatestCommunityInitiativesSection } from "./LatestCommunityInitiativesSection";
import { RegistrationGatewayWorkspaceSection } from "./RegistrationGatewayWorkspaceSection";

interface CommunityExperiencePageProps {
  slug: string;
  projections: CommunityExperiencePublicProjections;
  catalog: CommunityExperiencePageData["catalog"];
}

export async function CommunityExperiencePage({
  slug,
  projections,
  catalog,
}: CommunityExperiencePageProps) {
  const { identity, statistics, pipeline, latestInitiatives, impactOverview } = projections;

  return (
    <div className="community-experience-page">
      <a href="#main-content" className="community-experience-page__skip-link">
        Skip to main content
      </a>
      <CommunityGeographicNavigator identity={identity} />

      <main className="community-experience-page__main" id="main-content">
        <div className="community-experience-page__content">
          <CommunityIdentitySection identity={identity} />
          <CommunityStatisticsSection projection={statistics} communityName={identity.name} />
          <CommunityParticipationPipelineSection
            projection={pipeline}
            communityName={identity.name}
          />
          <LatestCommunityInitiativesSection
            projection={latestInitiatives}
            communityName={identity.name}
          />
          <CommunityImpactOverviewSection projection={impactOverview} />
          <FindYourCommunitySection catalog={catalog} currentCommunitySlug={slug} />
          <RegistrationGatewayWorkspaceSection communityName={identity.name} />
        </div>
      </main>
    </div>
  );
}

export { loadCommunityExperiencePageData };
