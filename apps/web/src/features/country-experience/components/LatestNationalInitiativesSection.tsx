import type { LatestInitiativesPublicProjection } from "@hu/types";

import {
  NATIONAL_INITIATIVES_VISITOR_CONCLUSION,
  nationalInitiativesContextIntroduction,
} from "../content";
import { ExperienceBlockShell } from "../../global-experience/components/ExperienceBlockShell";
import { LatestInitiativeCard } from "../../global-experience/components/LatestInitiativeCard";

interface LatestNationalInitiativesSectionProps {
  projection: LatestInitiativesPublicProjection;
  countryName: string;
}

export function LatestNationalInitiativesSection({
  projection,
  countryName,
}: LatestNationalInitiativesSectionProps) {
  return (
    <ExperienceBlockShell
      id="latest-national-initiatives"
      title="Latest National Initiatives"
      architecturalName="Latest Initiatives"
      stage="Evidence"
      contextIntroduction={nationalInitiativesContextIntroduction(countryName)}
      visitorConclusion={NATIONAL_INITIATIVES_VISITOR_CONCLUSION}
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
            No public initiatives are associated with this country yet.
          </p>
        )}
      </div>
    </ExperienceBlockShell>
  );
}
