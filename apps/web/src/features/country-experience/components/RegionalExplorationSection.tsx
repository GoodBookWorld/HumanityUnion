import type { CountryRegionalCatalogPublicProjection } from "@hu/types";

import { REGIONAL_EXPLORATION_CONTENT } from "../content";
import { ExperienceBlockShell } from "../../public-experience";
import { RegionalExplorationEvidence } from "./RegionalExplorationEvidence";

interface RegionalExplorationSectionProps {
  catalog: CountryRegionalCatalogPublicProjection;
  countryName: string;
}

export function RegionalExplorationSection({
  catalog,
  countryName,
}: RegionalExplorationSectionProps) {
  return (
    <ExperienceBlockShell
      id="regional-exploration"
      title={REGIONAL_EXPLORATION_CONTENT.title}
      architecturalName="Exploration"
      stage="Exploration"
      contextIntroduction={REGIONAL_EXPLORATION_CONTENT.contextIntroduction}
      visitorConclusion={REGIONAL_EXPLORATION_CONTENT.visitorConclusion}
    >
      <RegionalExplorationEvidence catalog={catalog} countryName={countryName} />
    </ExperienceBlockShell>
  );
}
