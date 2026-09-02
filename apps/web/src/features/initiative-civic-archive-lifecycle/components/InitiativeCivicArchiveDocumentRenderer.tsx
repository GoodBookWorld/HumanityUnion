"use client";

import { useTranslations } from "next-intl";

import type { InitiativeLifecycleArchiveDocument } from "@hu/types";

import {
  resolveCivicArchiveCompletenessSummaryDisplay,
  resolveCivicArchiveSectionDisplayLabel,
  resolveCivicArchiveTimelineStatusDisplayLabel,
} from "../../public-initiative-experience/initiative-experience-i18n";

/**
 * Initiative Lifecycle — Part M, Section 22. Shared Archive Document
 * renderer for Author preview, Draft Preview, and Public Result.
 */
export function InitiativeCivicArchiveDocumentRenderer({
  document,
  metaLabel,
}: {
  readonly document: InitiativeLifecycleArchiveDocument;
  readonly metaLabel?: string;
}) {
  const t = useTranslations("initiativeExperience");

  return (
    <article className="ica-public" aria-label={t("author.archive.document.aria")}>
      {metaLabel ? <p className="ica-public__meta">{metaLabel}</p> : null}
      <section className="ica-public__section">
        <h3>{document.finalArchiveTitle || t("author.archive.document.untitled")}</h3>
        <p className="ica-public__meta">
          {document.archiveVersion != null
            ? t("author.archive.document.version", { version: document.archiveVersion })
            : t("author.archive.document.draftPreview")}
          {document.publishedAt
            ? t("author.archive.document.publishedAt", { date: document.publishedAt })
            : ""}
        </p>
        {document.finalSummary.trim() ? (
          <p style={{ whiteSpace: "pre-wrap" }}>{document.finalSummary}</p>
        ) : null}
        <p className="ica-public__meta">
          {t("author.archive.document.participationStats", {
            signatures: document.participationStatistics.signatureCount,
            support: document.participationStatistics.supportCount,
            reactions: document.participationStatistics.reactionCount,
            allies: document.participationStatistics.activeAllyCount,
          })}
        </p>
      </section>

      <section className="ica-public__section">
        <h3>{t("author.archive.document.lifecycleTimeline")}</h3>
        <ul className="ica-source-panel__list">
          {document.timeline.map((entry) => (
            <li className="ica-source-panel__item" key={entry.stageId}>
              <span className="ica-source-panel__label">{entry.label}</span>
              <p className="ica-source-panel__summary">
                {resolveCivicArchiveTimelineStatusDisplayLabel(entry.status, t)}
                {entry.publishedAt ? ` · ${entry.publishedAt}` : ""}
                {entry.version != null ? ` · v${entry.version}` : ""}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {document.sections.map((section) => (
        <section className="ica-public__section" key={section.sectionId} id={section.sectionId}>
          <h3>{resolveCivicArchiveSectionDisplayLabel(section.sectionId, t)}</h3>
          {section.body.trim() ? (
            <p style={{ whiteSpace: "pre-wrap" }}>{section.body}</p>
          ) : (
            <p className="ica-public__meta">{t("author.archive.document.emptySection")}</p>
          )}
          {section.sourceRecordIds.length > 0 ? (
            <p className="ica-public__meta">
              {t("author.archive.document.sources", {
                list: section.sourceRecordIds.join(" · "),
              })}
            </p>
          ) : null}
        </section>
      ))}

      <section className="ica-public__section">
        <h3>{t("author.archive.document.completeness")}</h3>
        <p style={{ whiteSpace: "pre-wrap" }}>
          {resolveCivicArchiveCompletenessSummaryDisplay(document.completeness, t)}
        </p>
      </section>

      <p className="ica-public__meta">{t("author.archive.document.disclaimer")}</p>
    </article>
  );
}
