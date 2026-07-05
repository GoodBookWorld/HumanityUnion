import type { CountryExperiencePublicProjections } from "@hu/types";

import { CountryGeographicNavigator } from "./CountryGeographicNavigator";
import { CountryIdentitySection } from "./CountryIdentitySection";
import { LatestNationalInitiativesSection } from "./LatestNationalInitiativesSection";
import { NationalInteractiveMapSection } from "./NationalInteractiveMapSection";
import { NationalParticipationPipelineSection } from "./NationalParticipationPipelineSection";
import { NationalStatisticsSection } from "./NationalStatisticsSection";
import { RegionalExplorationSection } from "./RegionalExplorationSection";
import { TrustedNationalMediaSection } from "./TrustedNationalMediaSection";
import {
  PublicExperienceFooter,
  PublicExperienceHeader,
  RegistrationGatewaySection,
} from "../../public-experience";

interface CountryExperiencePageProps {
  projections: CountryExperiencePublicProjections;
}

export function CountryExperiencePage({ projections }: CountryExperiencePageProps) {
  const {
    identity,
    statistics,
    pipeline,
    latestInitiatives,
    trustedNationalMedia,
    regionalCatalog,
  } = projections;

  return (
    <div className="country-experience-page">
      <a href="#main-content" className="country-experience-page__skip-link">
        Skip to main content
      </a>
      <PublicExperienceHeader currentDestination="Home" />
      <CountryGeographicNavigator identity={identity} />

      <main className="country-experience-page__main" id="main-content">
        <div className="country-experience-page__content">
          <CountryIdentitySection identity={identity} />
          <NationalInteractiveMapSection />
          <NationalStatisticsSection projection={statistics} countryName={identity.name} />
          <NationalParticipationPipelineSection projection={pipeline} countryName={identity.name} />
          <LatestNationalInitiativesSection
            projection={latestInitiatives}
            countryName={identity.name}
          />
          {trustedNationalMedia ? (
            <TrustedNationalMediaSection projection={trustedNationalMedia} />
          ) : null}
          <RegionalExplorationSection catalog={regionalCatalog} countryName={identity.name} />
          <RegistrationGatewaySection />
        </div>
      </main>

      <PublicExperienceFooter />
    </div>
  );
}
