"use client";

import { useTranslations } from "next-intl";

import type { InitiativeDecisionSessionIntelligenceSnapshot } from "@hu/types";

export function InitiativeDecisionSessionIntelligenceSnapshotPanel({
  snapshot,
}: {
  snapshot: InitiativeDecisionSessionIntelligenceSnapshot;
}) {
  const t = useTranslations("initiativeExperience");

  if (snapshot.isEmpty) {
    return <p className="ids-source-panel__empty">{t("author.decisionSession.sourceSnapshot.empty")}</p>;
  }

  return (
    <section className="ids-source-panel" aria-label={t("author.decisionSession.sourceSnapshot.aria")}>
      <ul className="ids-source-panel__list">
        <li className="ids-source-panel__item">
          <span className="ids-source-panel__label">
            {t("author.decisionSession.sourceSnapshot.publishedPetition")}
          </span>
          <p className="ids-source-panel__summary">
            {snapshot.petitionReference
              ? t("author.decisionSession.sourceSnapshot.petitionSummary", {
                  title: snapshot.petitionReference.title,
                  participants: snapshot.petitionReference.participantSignatures,
                  members: snapshot.petitionReference.memberSignatures,
                  visitors: snapshot.petitionReference.visitorSignals,
                })
              : t("author.decisionSession.sourceSnapshot.noPetition")}
          </p>
        </li>
        <li className="ids-source-panel__item">
          <span className="ids-source-panel__label">
            {t("author.decisionSession.sourceSnapshot.publishedRevision")}
          </span>
          <p className="ids-source-panel__summary">
            {snapshot.revisionReference
              ? t("author.decisionSession.sourceSnapshot.revisionSummary", {
                  version: snapshot.revisionReference.version,
                  summary: snapshot.revisionReference.revisionSummary,
                })
              : t("author.decisionSession.sourceSnapshot.noRevision")}
          </p>
        </li>
        <li className="ids-source-panel__item">
          <span className="ids-source-panel__label">
            {t("author.decisionSession.sourceSnapshot.collaborativeAnalysis")}
          </span>
          <p className="ids-source-panel__summary">
            {snapshot.analysisReference?.title ??
              t("author.decisionSession.sourceSnapshot.noAnalysis")}
          </p>
        </li>
        <li className="ids-source-panel__item">
          <span className="ids-source-panel__label">
            {t("author.decisionSession.sourceSnapshot.improvementProposals")}
          </span>
          <p className="ids-source-panel__summary">
            {t("author.decisionSession.sourceSnapshot.proposalsCount", {
              count: snapshot.proposalReferences.length,
            })}
          </p>
        </li>
        <li className="ids-source-panel__item">
          <span className="ids-source-panel__label">
            {t("author.decisionSession.sourceSnapshot.allyRecommendations")}
          </span>
          <p className="ids-source-panel__summary">
            {t("author.decisionSession.sourceSnapshot.allyCount", {
              recommendations: snapshot.allyRecommendations.length,
              allies: snapshot.activeAllyCount,
            })}
          </p>
        </li>
        <li className="ids-source-panel__item">
          <span className="ids-source-panel__label">
            {t("author.decisionSession.sourceSnapshot.openComments")}
          </span>
          <p className="ids-source-panel__summary">
            {t("author.decisionSession.sourceSnapshot.commentsCount", {
              count: snapshot.openComments.length,
            })}
          </p>
        </li>
      </ul>
    </section>
  );
}
