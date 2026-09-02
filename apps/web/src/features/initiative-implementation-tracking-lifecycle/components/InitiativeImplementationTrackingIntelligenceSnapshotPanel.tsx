"use client";

import { useTranslations } from "next-intl";

import type { InitiativeImplementationTrackingIntelligenceSnapshot } from "@hu/types";

export function InitiativeImplementationTrackingIntelligenceSnapshotPanel({
  snapshot,
}: {
  snapshot: InitiativeImplementationTrackingIntelligenceSnapshot;
}) {
  const t = useTranslations("initiativeExperience");

  if (snapshot.isEmpty) {
    return (
      <p className="iit-source-panel__empty">{t("author.tracking.sourceSnapshot.empty")}</p>
    );
  }

  return (
    <section className="iit-source-panel" aria-label={t("author.tracking.sourceSnapshot.aria")}>
      <ul className="iit-source-panel__list">
        <li className="iit-source-panel__item">
          <span className="iit-source-panel__label">
            {t("author.tracking.sourceSnapshot.publishedPackage")}
          </span>
          <p className="iit-source-panel__summary">
            {snapshot.packageReference
              ? t("author.tracking.sourceSnapshot.packageSummary", {
                  title: snapshot.packageReference.title,
                  count: snapshot.acceptedCommitments.length,
                })
              : t("author.tracking.sourceSnapshot.noPackage")}
          </p>
        </li>
        <li className="iit-source-panel__item">
          <span className="iit-source-panel__label">
            {t("author.tracking.sourceSnapshot.activeAllies")}
          </span>
          <p className="iit-source-panel__summary">
            {t("author.tracking.sourceSnapshot.alliesActive", {
              count: snapshot.activeAllyCount,
            })}
          </p>
        </li>
        <li className="iit-source-panel__item">
          <span className="iit-source-panel__label">
            {t("author.tracking.sourceSnapshot.consistencyChecks")}
          </span>
          <p className="iit-source-panel__summary">
            {t("author.tracking.sourceSnapshot.consistencySummary", {
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
