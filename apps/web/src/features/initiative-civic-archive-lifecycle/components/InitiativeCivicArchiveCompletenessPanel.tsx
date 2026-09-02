"use client";

import { useTranslations } from "next-intl";

import type { InitiativeCivicArchiveCompleteness } from "@hu/types";

export function InitiativeCivicArchiveCompletenessPanel({
  completeness,
}: {
  readonly completeness: InitiativeCivicArchiveCompleteness;
  /** @deprecated Unused after Step 04 — Public Impact is SOURCE_OPTIONAL. */
  readonly lifecycleProfile?: string | null;
}) {
  const t = useTranslations("initiativeExperience");

  const publicImpactStatus = completeness.publicImpactAvailable
    ? t("author.archive.completeness.available")
    : t("author.archive.completeness.notAvailable");
  const traceabilityStatus = completeness.traceabilityComplete
    ? t("author.archive.completeness.traceabilityComplete")
    : t("author.archive.completeness.traceabilityIncomplete");

  return (
    <section className="ica-source-panel" aria-label={t("author.archive.document.completeness")}>
      <ul className="ica-source-panel__list">
        <li className="ica-source-panel__item">
          <span className="ica-source-panel__label">{t("author.archive.completeness.summary")}</span>
          <p className="ica-source-panel__summary">{completeness.summary}</p>
        </li>
        <li className="ica-source-panel__item">
          <span className="ica-source-panel__label">
            {t("author.archive.completeness.stagesPublished")}
          </span>
          <p className="ica-source-panel__summary">
            {completeness.stagesPublished.length > 0
              ? completeness.stagesPublished.join(", ")
              : t("author.archive.completeness.noneYet")}
          </p>
        </li>
        <li className="ica-source-panel__item">
          <span className="ica-source-panel__label">
            {t("author.archive.completeness.missingOptional")}
          </span>
          <p className="ica-source-panel__summary">
            {completeness.missingOptionalStages.length > 0
              ? completeness.missingOptionalStages.join(", ")
              : t("author.archive.completeness.none")}
          </p>
        </li>
        <li className="ica-source-panel__item">
          <span className="ica-source-panel__label">
            {t("author.archive.completeness.outstandingWork")}
          </span>
          <p className="ica-source-panel__summary">
            {t("author.archive.completeness.outstandingCounts", {
              unresolvedTracking: completeness.unresolvedTrackingCount,
              unfinishedCommitments: completeness.unfinishedCommitmentCount,
              missingEvidence: completeness.missingEvidenceCount,
            })}
          </p>
        </li>
        <li className="ica-source-panel__item">
          <span className="ica-source-panel__label">
            {t("author.archive.completeness.publicImpactOptional")}
          </span>
          <p className="ica-source-panel__summary">
            {`${publicImpactStatus} · ${traceabilityStatus}`}
          </p>
        </li>
      </ul>
    </section>
  );
}
