import type { LatestInitiativesPublicProjection } from "@hu/types";

import {
  COMMUNITY_INITIATIVES_VISITOR_CONCLUSION,
  communityInitiativesContextIntroduction,
} from "../content";
import { ExperienceBlockShell } from "../../global-experience/components/ExperienceBlockShell";
import { LatestInitiativeCard } from "../../global-experience/components/LatestInitiativeCard";

interface LatestCommunityInitiativesSectionProps {
  projection: LatestInitiativesPublicProjection;
  communityName: string;
}

export function LatestCommunityInitiativesSection({
  projection,
  communityName,
}: LatestCommunityInitiativesSectionProps) {
  return (
    <ExperienceBlockShell
      id="latest-community-initiatives"
      title="Latest Community Initiatives"
      architecturalName="Latest Initiatives"
      stage="Evidence"
      contextIntroduction={communityInitiativesContextIntroduction(communityName)}
      visitorConclusion={COMMUNITY_INITIATIVES_VISITOR_CONCLUSION}
    >
      <div className="latest-global-initiatives">
        <p className="latest-global-initiatives__scope">
          Scope: {projection.scopeLabel}
          {projection.source === "bootstrap" ? (
            <span className="latest-global-initiatives__source">
              {" "}
              · Bootstrap demonstration data
            </span>
          ) : null}
        </p>

        {projection.initiatives.length > 0 ? (
          <ul className="latest-global-initiatives__list">
            {projection.initiatives.map((initiative) => (
              <li key={initiative.initiativeId}>
                <LatestInitiativeCard initiative={initiative} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="latest-global-initiatives__empty">
            No public initiatives are associated with this community yet.
          </p>
        )}
      </div>
    </ExperienceBlockShell>
  );
}
