"use client";

import { useTranslations } from "next-intl";

import type { InitiativeImplementationCommitmentIntelligenceSnapshot } from "@hu/types";

export function InitiativeImplementationCommitmentIntelligenceSnapshotPanel({
  snapshot,
}: {
  snapshot: InitiativeImplementationCommitmentIntelligenceSnapshot;
}) {
  const t = useTranslations("initiativeExperience");

  if (snapshot.isEmpty) {
    return (
      <p className="iic-source-panel__empty">{t("author.commitment.sourceSnapshot.empty")}</p>
    );
  }

  return (
    <section className="iic-source-panel" aria-label={t("author.commitment.sourceSnapshot.aria")}>
      <ul className="iic-source-panel__list">
        <li className="iic-source-panel__item">
          <span className="iic-source-panel__label">
            {t("author.commitment.sourceSnapshot.publishedDecision")}
          </span>
          <p className="iic-source-panel__summary">
            {snapshot.decisionReference
              ? t("author.commitment.sourceSnapshot.decisionSummary", {
                  title: snapshot.decisionReference.title,
                  count: snapshot.decisionReference.approvedActions.length,
                })
              : t("author.commitment.sourceSnapshot.noDecision")}
          </p>
        </li>
        <li className="iic-source-panel__item">
          <span className="iic-source-panel__label">
            {t("author.commitment.sourceSnapshot.activeAllies")}
          </span>
          <p className="iic-source-panel__summary">
            {t("author.commitment.sourceSnapshot.alliesActive", {
              count: snapshot.activeAllyCount,
            })}
          </p>
        </li>
        <li className="iic-source-panel__item">
          <span className="iic-source-panel__label">
            {t("author.commitment.sourceSnapshot.consistencyChecks")}
          </span>
          <p className="iic-source-panel__summary">
            {t("author.commitment.sourceSnapshot.consistencySummary", {
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
