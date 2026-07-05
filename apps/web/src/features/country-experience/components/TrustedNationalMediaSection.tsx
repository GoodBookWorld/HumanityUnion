import type { TrustedNationalMediaPublicProjection } from "@hu/types";

import { TRUSTED_NATIONAL_MEDIA_CONTENT } from "../content";
import { ExperienceBlockShell } from "../../global-experience/components/ExperienceBlockShell";
import { TrustedNationalMediaEvidence } from "./TrustedNationalMediaEvidence";

interface TrustedNationalMediaSectionProps {
  projection: TrustedNationalMediaPublicProjection;
}

export function TrustedNationalMediaSection({ projection }: TrustedNationalMediaSectionProps) {
  return (
    <ExperienceBlockShell
      id="trusted-national-media"
      title={TRUSTED_NATIONAL_MEDIA_CONTENT.title}
      architecturalName="Trusted Media Carousel"
      stage="Exploration"
      contextIntroduction={TRUSTED_NATIONAL_MEDIA_CONTENT.contextIntroduction}
      visitorConclusion={TRUSTED_NATIONAL_MEDIA_CONTENT.visitorConclusion}
    >
      <TrustedNationalMediaEvidence projection={projection} />
    </ExperienceBlockShell>
  );
}
