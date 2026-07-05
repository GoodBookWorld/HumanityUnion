import Link from "next/link";

import type { CommunityImpactOverviewPublicProjection } from "@hu/types";

import {
  COMMUNITY_IMPACT_VISITOR_CONCLUSION,
  communityImpactContextIntroduction,
} from "../content";
import { ExperienceBlockShell } from "../../global-experience/components/ExperienceBlockShell";

interface CommunityImpactOverviewSectionProps {
  projection: CommunityImpactOverviewPublicProjection;
}

export function CommunityImpactOverviewSection({
  projection,
}: CommunityImpactOverviewSectionProps) {
  return (
    <ExperienceBlockShell
      id="community-impact-overview"
      title="Community Impact Overview"
      architecturalName="Evidence synthesis"
      stage="Evidence"
      contextIntroduction={communityImpactContextIntroduction(projection.communityName)}
      visitorConclusion={COMMUNITY_IMPACT_VISITOR_CONCLUSION}
    >
      <div className="community-impact-overview">
        <p className="community-impact-overview__scope">
          Observable outcomes at {projection.scopeLabel}
          {projection.source === "bootstrap" ? (
            <span className="community-impact-overview__source">
              {" "}
              · Bootstrap demonstration data
            </span>
          ) : null}
        </p>

        <dl className="community-impact-overview__signals" aria-label="Observable outcome signals">
          {projection.signals.map((signal) => (
            <div key={signal.id} className="community-impact-overview__signal">
              <dt className="community-impact-overview__signal-label">
                {signal.label}
                {signal.derived ? (
                  <span className="community-impact-overview__derived"> derived</span>
                ) : null}
              </dt>
              <dd className="community-impact-overview__signal-value">
                {signal.value}
                {signal.verificationHref ? (
                  <>
                    {" "}
                    · <Link href={signal.verificationHref}>Verify public record</Link>
                  </>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </ExperienceBlockShell>
  );
}
