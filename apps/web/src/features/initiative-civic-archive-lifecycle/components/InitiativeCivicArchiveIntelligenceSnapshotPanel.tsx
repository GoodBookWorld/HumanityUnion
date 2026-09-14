"use client";

import { useTranslations } from "next-intl";

import type { InitiativeCivicArchiveIntelligenceSnapshot } from "@hu/types";

import { InitiativeCivicArchiveCompletenessPanel } from "./InitiativeCivicArchiveCompletenessPanel";

export function InitiativeCivicArchiveIntelligenceSnapshotPanel({
  snapshot,
}: {
  snapshot: InitiativeCivicArchiveIntelligenceSnapshot;
  /** @deprecated Unused after Step 04 — Public Impact is SOURCE_OPTIONAL. */
  lifecycleProfile?: string | null;
}) {
  const t = useTranslations("initiativeExperience");

  if (snapshot.isEmpty) {
    return <p className="ica-source-panel__empty">{t("author.archive.sourceSnapshot.empty")}</p>;
  }

  const upstreamSummary =
    [
      snapshot.analysisReference ? t("author.archive.sourceSnapshot.analysis") : null,
      snapshot.proposalReferences.length > 0
        ? t("author.archive.sourceSnapshot.proposals", {
            count: snapshot.proposalReferences.length,
          })
        : null,
      snapshot.revisionReference ? t("author.archive.sourceSnapshot.revision") : null,
      snapshot.petitionReference ? t("author.archive.sourceSnapshot.petition") : null,
      snapshot.decisionSessionReference ? t("author.archive.sourceSnapshot.decisionSession") : null,
      snapshot.decisionReference ? t("author.archive.sourceSnapshot.collectiveDecision") : null,
      snapshot.commitmentPackageReference ? t("author.archive.sourceSnapshot.commitments") : null,
      snapshot.trackingPackageReference ? t("author.archive.sourceSnapshot.tracking") : null,
      snapshot.officialResponsePackageReference
        ? t("author.archive.sourceSnapshot.officialResponses")
        : null,
      snapshot.publicImpactReportReference
        ? t("author.archive.sourceSnapshot.publicImpactOptional")
        : null,
    ]
      .filter(Boolean)
      .join(" · ") || t("author.archive.sourceSnapshot.noUpstream");

  return (
    <div className="ica-source-panel">
      <section aria-label={t("author.archive.sourceSnapshot.aria")}>
        <ul className="ica-source-panel__list">
          <li className="ica-source-panel__item">
            <span className="ica-source-panel__label">
              {t("author.archive.sourceSnapshot.upstreamPackages")}
            </span>
            <p className="ica-source-panel__summary">{upstreamSummary}</p>
          </li>
          <li className="ica-source-panel__item">
            <span className="ica-source-panel__label">
              {t("author.archive.sourceSnapshot.communityParticipation")}
            </span>
            <p className="ica-source-panel__summary">
              {t("author.archive.sourceSnapshot.participationSummary", {
                signatures: snapshot.participationStatistics.signatureCount,
                support: snapshot.participationStatistics.supportCount,
                reactions: snapshot.participationStatistics.reactionCount,
                allies: snapshot.participationStatistics.activeAllyCount,
              })}
            </p>
          </li>
          <li className="ica-source-panel__item">
            <span className="ica-source-panel__label">
              {t("author.archive.sourceSnapshot.consistencyChecks")}
            </span>
            <p className="ica-source-panel__summary">
              {t("author.archive.sourceSnapshot.consistencySummary", {
                warnings: snapshot.consistencyChecks.filter((check) => check.status === "warning")
                  .length,
                total: snapshot.consistencyChecks.length,
              })}
            </p>
          </li>
        </ul>
      </section>
      <InitiativeCivicArchiveCompletenessPanel completeness={snapshot.completeness} />
    </div>
  );
}
