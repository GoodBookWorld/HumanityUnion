"use client";

import { useTranslations } from "next-intl";

import type {
  InitiativePublicImpactParticipationStatistics,
  InitiativePublicImpactReportSection,
} from "@hu/types";

import { resolvePublicImpactSectionDisplayLabel } from "../../public-initiative-experience/initiative-experience-i18n";

/**
 * Initiative Lifecycle — Part L, Section 12. Shared Public Impact Report
 * renderer used by both Draft Preview and the published Public Result —
 * same component, different data source.
 */
export function InitiativePublicImpactReportRenderer({
  title,
  sections,
  participationStatistics,
  metaLabel,
}: {
  readonly title: string;
  readonly sections: readonly InitiativePublicImpactReportSection[];
  readonly participationStatistics: InitiativePublicImpactParticipationStatistics;
  readonly metaLabel?: string;
}) {
  const t = useTranslations("initiativeExperience");

  return (
    <article className="ipi-public" aria-label={t("author.publicImpact.report.aria")}>
      {metaLabel ? <p className="ipi-public__meta">{metaLabel}</p> : null}
      <section className="ipi-public__section">
        <h3>{title || t("author.publicImpact.report.untitled")}</h3>
        <p className="ipi-public__meta">
          {t("author.publicImpact.report.participationStats", {
            signatures: participationStatistics.signatureCount,
            support: participationStatistics.supportCount,
            reactions: participationStatistics.reactionCount,
            allies: participationStatistics.activeAllyCount,
          })}
        </p>
      </section>
      {sections.map((section) => (
        <section className="ipi-public__section" key={section.sectionId}>
          <h3>
            {section.title ||
              resolvePublicImpactSectionDisplayLabel(section.sectionId, t)}
          </h3>
          {section.body.trim() ? (
            <p style={{ whiteSpace: "pre-wrap" }}>{section.body}</p>
          ) : (
            <p className="ipi-public__meta">{t("author.publicImpact.report.emptySection")}</p>
          )}
          {section.evidenceReferences.length > 0 ? (
            <p className="ipi-public__meta">
              {t("author.publicImpact.report.evidence", {
                refs: section.evidenceReferences.join(" · "),
              })}
            </p>
          ) : null}
        </section>
      ))}
    </article>
  );
}
