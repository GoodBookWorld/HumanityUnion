import { REGIONAL_INTERACTIVE_MAP_CONTENT } from "../content";
import { ExperienceBlockShell } from "../../public-experience";
import { RegionalInteractiveMapEvidence } from "./RegionalInteractiveMapEvidence";

export function RegionalInteractiveMapSection() {
  return (
    <ExperienceBlockShell
      id="regional-interactive-map"
      title={REGIONAL_INTERACTIVE_MAP_CONTENT.title}
      architecturalName="Interactive Map"
      stage="Evidence"
      contextIntroduction={REGIONAL_INTERACTIVE_MAP_CONTENT.contextIntroduction}
    >
      <RegionalInteractiveMapEvidence />
    </ExperienceBlockShell>
  );
}
