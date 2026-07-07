import { loadGlobalExperienceProjections } from "../../public-projection-engine";
import { RegistrationGatewaySection } from "../../public-experience";
import { CivicIntroductionSection } from "./CivicIntroductionSection";
import { GeographicNavigator } from "./GeographicNavigator";
import { GlobalStatisticsSection } from "./GlobalStatisticsSection";
import { InteractiveWorldMapSection } from "./InteractiveWorldMapSection";
import { LatestGlobalInitiativesSection } from "./LatestGlobalInitiativesSection";
import { ParticipationPipelineSection } from "./ParticipationPipelineSection";

export async function GlobalExperiencePage() {
  const {
    statistics: statisticsProjection,
    pipeline: pipelineProjection,
    latestInitiatives: latestInitiativesProjection,
  } = await loadGlobalExperienceProjections();

  return (
    <div className="global-experience-page">
      <a href="#main-content" className="global-experience-page__skip-link">
        Skip to main content
      </a>
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
    </div>
  );
}
