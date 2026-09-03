"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import type { CommunityImpactOverviewPublicProjection } from "@hu/types";

import { ExperienceBlockShell } from "../../public-experience";

interface CommunityImpactOverviewSectionProps {
  projection: CommunityImpactOverviewPublicProjection;
}

export function CommunityImpactOverviewSection({
  projection,
}: CommunityImpactOverviewSectionProps) {
  const t = useTranslations("publicGeo");

  return (
    <ExperienceBlockShell
      id="community-impact-overview"
      title={t("community.impact.title")}
      architecturalName={t("community.impact.architecturalName")}
      stage={t("community.impact.stage")}
      contextIntroduction={t("community.impact.contextIntroduction", {
        communityName: projection.communityName,
      })}
      visitorConclusion={t("community.impact.visitorConclusion")}
    >
      <div className="community-impact-overview">
        <p className="community-impact-overview__scope">
          {t("community.impact.observableOutcomes", { scope: projection.scopeLabel })}
          {projection.source === "bootstrap" ? (
            <span className="community-impact-overview__source">
              {" "}
              · {t("shared.bootstrapSource")}
            </span>
          ) : null}
        </p>

        <p className="community-impact-overview__observable-note" role="note">
          {t("community.impact.observableNote")}
        </p>

        <dl
          className="community-impact-overview__signals"
          aria-label={t("community.impact.signalsAria")}
        >
          {projection.signals.map((signal) => (
            <div key={signal.id} className="community-impact-overview__signal">
              <dt className="community-impact-overview__signal-label">
                {signal.label}
                {signal.derived ? (
                  <span className="community-impact-overview__derived">
                    {" "}
                    {t("shared.derived")}
                  </span>
                ) : null}
              </dt>
              <dd className="community-impact-overview__signal-value">
                {signal.value}
                {signal.verificationHref &&
                (signal.verificationRouteStatus ?? "active") === "active" ? (
                  <>
                    {" "}
                    · <Link href={signal.verificationHref}>{t("community.impact.verifyRecord")}</Link>
                  </>
                ) : signal.verificationRouteStatus === "unavailable" ? (
                  <>
                    {" "}
                    ·{" "}
                    <span
                      className="community-impact-overview__verification-placeholder"
                      aria-disabled="true"
                      title={t("community.impact.verifyComingSoonTitle")}
                    >
                      {t("community.impact.verifyComingSoon")}
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
