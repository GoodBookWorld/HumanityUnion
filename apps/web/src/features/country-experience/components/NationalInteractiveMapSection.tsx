import { NATIONAL_INTERACTIVE_MAP_CONTENT } from "../content";
import { ExperienceBlockShell } from "../../public-experience";
import { NationalInteractiveMapEvidence } from "./NationalInteractiveMapEvidence";

export function NationalInteractiveMapSection() {
  return (
    <ExperienceBlockShell
      id="national-interactive-map"
      title={NATIONAL_INTERACTIVE_MAP_CONTENT.title}
      architecturalName="Interactive Map"
      stage="Evidence"
      contextIntroduction={NATIONAL_INTERACTIVE_MAP_CONTENT.contextIntroduction}
    >
      <NationalInteractiveMapEvidence />
    </ExperienceBlockShell>
  );
}
