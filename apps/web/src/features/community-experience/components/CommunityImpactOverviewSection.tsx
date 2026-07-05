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

        <p className="community-impact-overview__observable-note" role="note">
          Signals describe publicly observable counts and stage presence — not subjective impact
          judgments or community evaluations.
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
                {signal.verificationHref &&
                (signal.verificationRouteStatus ?? "active") === "active" ? (
                  <>
                    {" "}
                    · <Link href={signal.verificationHref}>Verify public record</Link>
                  </>
                ) : signal.verificationRouteStatus === "unavailable" ? (
                  <>
                    {" "}
                    ·{" "}
                    <span
                      className="community-impact-overview__verification-placeholder"
                      aria-disabled="true"
                      title="Public verification record — coming soon"
                    >
                      Verify public record (coming soon)
                    </span>
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
