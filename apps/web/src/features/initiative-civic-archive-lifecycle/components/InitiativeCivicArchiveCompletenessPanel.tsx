"use client";

import { useTranslations } from "next-intl";

import type { InitiativeCivicArchiveCompleteness } from "@hu/types";

import {
  formatLifecycleStageDisplayList,
  resolveCivicArchiveCompletenessSummaryDisplay,
} from "../../public-initiative-experience/initiative-experience-i18n";

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

  const summaryText = resolveCivicArchiveCompletenessSummaryDisplay(completeness, t);
  const stagesPublishedLabel =
    completeness.stagesPublished.length > 0
      ? formatLifecycleStageDisplayList(completeness.stagesPublished, t)
      : t("author.archive.completeness.noneYet");
  const missingOptionalLabel =
    completeness.missingOptionalStages.length > 0
      ? formatLifecycleStageDisplayList(completeness.missingOptionalStages, t)
      : t("author.archive.completeness.none");

  return (
    <section className="ica-source-panel" aria-label={t("author.archive.document.completeness")}>
      <ul className="ica-source-panel__list">
        <li className="ica-source-panel__item">
          <span className="ica-source-panel__label">{t("author.archive.completeness.summary")}</span>
          <p className="ica-source-panel__summary">{summaryText}</p>
        </li>
        <li className="ica-source-panel__item">
          <span className="ica-source-panel__label">
            {t("author.archive.completeness.stagesPublished")}
          </span>
          <p className="ica-source-panel__summary">{stagesPublishedLabel}</p>
        </li>
        <li className="ica-source-panel__item">
          <span className="ica-source-panel__label">
            {t("author.archive.completeness.missingOptional")}
          </span>
          <p className="ica-source-panel__summary">{missingOptionalLabel}</p>
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
