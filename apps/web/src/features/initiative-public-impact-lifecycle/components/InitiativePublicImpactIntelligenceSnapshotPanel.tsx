"use client";

import { useTranslations } from "next-intl";

import type { InitiativePublicImpactIntelligenceSnapshot } from "@hu/types";

export function InitiativePublicImpactIntelligenceSnapshotPanel({
  snapshot,
}: {
  snapshot: InitiativePublicImpactIntelligenceSnapshot;
}) {
  const t = useTranslations("initiativeExperience");

  if (snapshot.isEmpty) {
    return (
      <p className="ipi-source-panel__empty">{t("author.publicImpact.sourceSnapshot.empty")}</p>
    );
  }

  return (
    <section className="ipi-source-panel" aria-label={t("author.publicImpact.sourceSnapshot.aria")}>
      <ul className="ipi-source-panel__list">
        <li className="ipi-source-panel__item">
          <span className="ipi-source-panel__label">
            {t("author.publicImpact.sourceSnapshot.publishedOfficialResponses")}
          </span>
          <p className="ipi-source-panel__summary">
            {snapshot.officialResponsePackageReference
              ? snapshot.officialResponsePackageReference.outcomeKind ===
                "no_official_response_received"
                ? t("author.publicImpact.sourceSnapshot.noResponseOutcome", {
                    title: snapshot.officialResponsePackageReference.title,
                  })
                : t("author.publicImpact.sourceSnapshot.responsesOutcome", {
                    title: snapshot.officialResponsePackageReference.title,
                    count: snapshot.officialResponseSummaries.length,
                  })
              : t("author.publicImpact.sourceSnapshot.noOfficialResponses")}
          </p>
        </li>
        <li className="ipi-source-panel__item">
          <span className="ipi-source-panel__label">
            {t("author.publicImpact.sourceSnapshot.implementationTracking")}
          </span>
          <p className="ipi-source-panel__summary">
            {snapshot.trackingPackageReference
              ? `${snapshot.trackingPackageReference.title} — ${t("author.publicImpact.sourceSnapshot.trackingCount", { count: snapshot.trackingRecords.length })}`
              : t("author.publicImpact.sourceSnapshot.noTracking")}
          </p>
        </li>
        <li className="ipi-source-panel__item">
          <span className="ipi-source-panel__label">
            {t("author.publicImpact.sourceSnapshot.completedCommitments")}
          </span>
          <p className="ipi-source-panel__summary">
            {t("author.publicImpact.sourceSnapshot.commitmentsCount", {
              count: snapshot.completedCommitmentCount,
            })}
          </p>
        </li>
        <li className="ipi-source-panel__item">
          <span className="ipi-source-panel__label">
            {t("author.publicImpact.sourceSnapshot.communityParticipation")}
          </span>
          <p className="ipi-source-panel__summary">
            {t("author.publicImpact.sourceSnapshot.participationSummary", {
              signatures: snapshot.participationStatistics.signatureCount,
              support: snapshot.participationStatistics.supportCount,
              reactions: snapshot.participationStatistics.reactionCount,
              allies: snapshot.participationStatistics.activeAllyCount,
            })}
          </p>
        </li>
        <li className="ipi-source-panel__item">
          <span className="ipi-source-panel__label">
            {t("author.publicImpact.sourceSnapshot.evidenceReferences")}
          </span>
          <p className="ipi-source-panel__summary">
            {t("author.publicImpact.sourceSnapshot.evidenceCount", {
              count: snapshot.evidenceItems.length,
            })}
          </p>
        </li>
        <li className="ipi-source-panel__item">
          <span className="ipi-source-panel__label">
            {t("author.publicImpact.sourceSnapshot.consistencyChecks")}
          </span>
          <p className="ipi-source-panel__summary">
            {t("author.publicImpact.sourceSnapshot.consistencySummary", {
              warnings: snapshot.consistencyChecks.filter((check) => check.status === "warning")
                .length,
              total: snapshot.consistencyChecks.length,
            })}
          </p>
        </li>
      </ul>
    </section>
  );
}
