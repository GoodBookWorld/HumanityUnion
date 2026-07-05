import { FIND_YOUR_COMMUNITY_CONTENT, FIND_YOUR_COMMUNITY_VISITOR_CONCLUSION } from "../content";
import { ExperienceBlockShell } from "../../public-experience";
import { FindYourCommunityEvidence } from "./FindYourCommunityEvidence";
import type { CommunityCatalogPublicProjection } from "@hu/types";

interface FindYourCommunitySectionProps {
  catalog: CommunityCatalogPublicProjection;
  currentCommunitySlug: string;
}

export function FindYourCommunitySection({
  catalog,
  currentCommunitySlug,
}: FindYourCommunitySectionProps) {
  return (
    <ExperienceBlockShell
      id="find-your-community"
      title={FIND_YOUR_COMMUNITY_CONTENT.title}
      architecturalName="Exploration"
      stage="Exploration"
      contextIntroduction={FIND_YOUR_COMMUNITY_CONTENT.contextIntroduction}
      visitorConclusion={FIND_YOUR_COMMUNITY_VISITOR_CONCLUSION}
    >
      <FindYourCommunityEvidence catalog={catalog} currentCommunitySlug={currentCommunitySlug} />
    </ExperienceBlockShell>
  );
}
