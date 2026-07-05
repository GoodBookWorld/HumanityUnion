import { getWorldLatestInitiativesPublicProjection } from "../projections/get-latest-initiatives-projection";
import {
  getWorldParticipationPipelinePublicProjection,
  getWorldParticipationPublicStatisticsProjection,
} from "../projections/get-world-projections";
import { CivicIntroductionSection } from "./CivicIntroductionSection";
import { GeographicNavigator } from "./GeographicNavigator";
import { GlobalStatisticsSection } from "./GlobalStatisticsSection";
import { InteractiveWorldMapSection } from "./InteractiveWorldMapSection";
import { LatestGlobalInitiativesSection } from "./LatestGlobalInitiativesSection";
import { ParticipationPipelineSection } from "./ParticipationPipelineSection";
import { PublicExperienceFooter } from "./PublicExperienceFooter";
import { PublicExperienceHeader } from "./PublicExperienceHeader";
import { RegistrationGatewaySection } from "./RegistrationGatewaySection";

export async function GlobalExperiencePage() {
  const [statisticsProjection, pipelineProjection, latestInitiativesProjection] = await Promise.all(
    [
      getWorldParticipationPublicStatisticsProjection(),
      getWorldParticipationPipelinePublicProjection(),
      getWorldLatestInitiativesPublicProjection(),
    ],
  );

  return (
    <div className="global-experience-page">
      <a href="#main-content" className="global-experience-page__skip-link">
        Skip to main content
      </a>
      <PublicExperienceHeader currentDestination="Home" />
      <GeographicNavigator />

      <main className="global-experience-page__main" id="main-content">
        <div className="global-experience-page__content">
          <CivicIntroductionSection />
          <InteractiveWorldMapSection />
          <GlobalStatisticsSection projection={statisticsProjection} />
          <ParticipationPipelineSection projection={pipelineProjection} />
          <LatestGlobalInitiativesSection projection={latestInitiativesProjection} />
          <RegistrationGatewaySection />
        </div>
      </main>

      <PublicExperienceFooter />
    </div>
  );
}
