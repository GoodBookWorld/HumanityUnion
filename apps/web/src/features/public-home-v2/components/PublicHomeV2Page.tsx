import { HumanityUnionInNumbers } from "../../platform-statistics/components/HumanityUnionInNumbers";
import { PublicHomeCivicArchiveSection } from "./PublicHomeCivicArchiveSection";
import { PublicHomeCivicMediaSection } from "./PublicHomeCivicMediaSection";
import { PublicHomeCivicPipelineSection } from "./PublicHomeCivicPipelineSection";
import { PublicHomeCoreValuesSection } from "./PublicHomeCoreValuesSection";
import { PublicHomeEcosystemStatementSection } from "./PublicHomeEcosystemStatementSection";
import { PublicHomeGeographicNavigationSection } from "./PublicHomeGeographicNavigationSection";
import { PublicHomeHeroSection } from "./PublicHomeHeroSection";
import { PublicHomeKnowledgeSection } from "./PublicHomeKnowledgeSection";
import { PublicHomeLatestInitiativesSection } from "./PublicHomeLatestInitiativesSection";
import { PublicHomeLatestPublicImpactSection } from "./PublicHomeLatestPublicImpactSection";
import { PublicHomeOpportunitySection } from "./PublicHomeOpportunitySection";

import "../public-home-v2.css";

export function PublicHomeV2Page() {
  return (
    <div className="public-home-v2">
      <PublicHomeHeroSection />
      <HumanityUnionInNumbers />
      <PublicHomeCoreValuesSection />
      <PublicHomeOpportunitySection />
      <PublicHomeCivicPipelineSection />
      <PublicHomeLatestInitiativesSection />
      <PublicHomeLatestPublicImpactSection />
      <PublicHomeKnowledgeSection />
      <PublicHomeCivicMediaSection />
      <PublicHomeCivicArchiveSection />
      <PublicHomeEcosystemStatementSection />
      <PublicHomeGeographicNavigationSection />
    </div>
  );
}
