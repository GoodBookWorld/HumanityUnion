import { INTERACTIVE_WORLD_MAP_CONTENT } from "../content";
import { ExperienceBlockShell } from "../../public-experience";
import { InteractiveWorldMapEvidence } from "./InteractiveWorldMapEvidence";

export function InteractiveWorldMapSection() {
  return (
    <ExperienceBlockShell
      id="interactive-world-map"
      title={INTERACTIVE_WORLD_MAP_CONTENT.title}
      architecturalName="Interactive Map"
      stage="Evidence"
      contextIntroduction={INTERACTIVE_WORLD_MAP_CONTENT.contextIntroduction}
    >
      <InteractiveWorldMapEvidence />
    </ExperienceBlockShell>
  );
}
