"use client";

import { useTranslations } from "next-intl";

import type { InitiativeOfficialResponseIntelligenceSnapshot } from "@hu/types";

export function InitiativeOfficialResponseIntelligenceSnapshotPanel({
  snapshot,
}: {
  snapshot: InitiativeOfficialResponseIntelligenceSnapshot;
}) {
  const t = useTranslations("initiativeExperience");

  if (snapshot.isEmpty) {
    return (
      <p className="ior-source-panel__empty">{t("author.officialResponse.sourceSnapshot.empty")}</p>
    );
  }

  return (
    <section
      className="ior-source-panel"
      aria-label={t("author.officialResponse.sourceSnapshot.aria")}
    >
      <ul className="ior-source-panel__list">
        <li className="ior-source-panel__item">
          <span className="ior-source-panel__label">
            {t("author.officialResponse.sourceSnapshot.publishedTracking")}
          </span>
          <p className="ior-source-panel__summary">
            {snapshot.trackingPackageReference
              ? t("author.officialResponse.sourceSnapshot.trackingSummary", {
                  title: snapshot.trackingPackageReference.title,
                  count: snapshot.trackingRecords.length,
                })
              : t("author.officialResponse.sourceSnapshot.noTracking")}
          </p>
        </li>
        <li className="ior-source-panel__item">
          <span className="ior-source-panel__label">
            {t("author.officialResponse.sourceSnapshot.completedCommitments")}
          </span>
          <p className="ior-source-panel__summary">
            {t("author.officialResponse.sourceSnapshot.completedCount", {
              count: snapshot.completedCommitmentCount,
            })}
          </p>
        </li>
        <li className="ior-source-panel__item">
          <span className="ior-source-panel__label">
            {t("author.officialResponse.sourceSnapshot.activeAllies")}
          </span>
          <p className="ior-source-panel__summary">
            {t("author.officialResponse.sourceSnapshot.alliesActive", {
              count: snapshot.activeAllyCount,
            })}
          </p>
        </li>
        <li className="ior-source-panel__item">
          <span className="ior-source-panel__label">
            {t("author.officialResponse.sourceSnapshot.consistencyChecks")}
          </span>
          <p className="ior-source-panel__summary">
            {t("author.officialResponse.sourceSnapshot.consistencySummary", {
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
