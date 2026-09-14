"use client";

import { useTranslations } from "next-intl";

import type { InitiativeCollectiveDecisionIntelligenceSnapshot } from "@hu/types";

export function InitiativeCollectiveDecisionIntelligenceSnapshotPanel({
  snapshot,
}: {
  snapshot: InitiativeCollectiveDecisionIntelligenceSnapshot;
  /** @deprecated Unused after Step 04 — Decision Session is SOURCE_OPTIONAL. */
  lifecycleProfile?: string | null;
}) {
  const t = useTranslations("initiativeExperience");

  if (snapshot.isEmpty) {
    return (
      <p className="icd-source-panel__empty">{t("author.collectiveDecision.sourceSnapshot.empty")}</p>
    );
  }

  return (
    <section
      className="icd-source-panel"
      aria-label={t("author.collectiveDecision.sourceSnapshot.aria")}
    >
      <ul className="icd-source-panel__list">
        {snapshot.decisionSessionReference ? (
          <li className="icd-source-panel__item">
            <span className="icd-source-panel__label">
              {t("author.collectiveDecision.sourceSnapshot.decisionSessionOptional")}
            </span>
            <p className="icd-source-panel__summary">
              {t("author.collectiveDecision.sourceSnapshot.decisionSessionSummary", {
                title: snapshot.decisionSessionReference.title,
                options: snapshot.decisionSessionReference.options.length,
                risks: snapshot.decisionSessionReference.risks.length,
              })}
            </p>
          </li>
        ) : null}
        <li className="icd-source-panel__item">
          <span className="icd-source-panel__label">
            {t("author.collectiveDecision.sourceSnapshot.publishedPetition")}
          </span>
          <p className="icd-source-panel__summary">
            {snapshot.petitionReference
              ? t("author.collectiveDecision.sourceSnapshot.petitionSummary", {
                  title: snapshot.petitionReference.title,
                  participants: snapshot.petitionReference.participantSignatures,
                  members: snapshot.petitionReference.memberSignatures,
                  visitors: snapshot.petitionReference.visitorSignals,
                })
              : t("author.collectiveDecision.sourceSnapshot.noPetition")}
          </p>
        </li>
        <li className="icd-source-panel__item">
          <span className="icd-source-panel__label">
            {t("author.collectiveDecision.sourceSnapshot.publishedRevision")}
          </span>
          <p className="icd-source-panel__summary">
            {snapshot.revisionReference
              ? t("author.collectiveDecision.sourceSnapshot.revisionSummary", {
                  version: snapshot.revisionReference.version,
                  summary: snapshot.revisionReference.revisionSummary,
                })
              : t("author.collectiveDecision.sourceSnapshot.noRevision")}
          </p>
        </li>
        <li className="icd-source-panel__item">
          <span className="icd-source-panel__label">
            {t("author.collectiveDecision.sourceSnapshot.collaborativeAnalysis")}
          </span>
          <p className="icd-source-panel__summary">
            {snapshot.analysisReference?.title ??
              t("author.collectiveDecision.sourceSnapshot.noAnalysis")}
          </p>
        </li>
        <li className="icd-source-panel__item">
          <span className="icd-source-panel__label">
            {t("author.collectiveDecision.sourceSnapshot.improvementProposals")}
          </span>
          <p className="icd-source-panel__summary">
            {t("author.collectiveDecision.sourceSnapshot.proposalsCount", {
              count: snapshot.proposalReferences.length,
            })}
          </p>
        </li>
        <li className="icd-source-panel__item">
          <span className="icd-source-panel__label">
            {t("author.collectiveDecision.sourceSnapshot.consistencyChecks")}
          </span>
          <p className="icd-source-panel__summary">
            {t("author.collectiveDecision.sourceSnapshot.consistencySummary", {
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
