"use client";

import type {
  InitiativePublicImpactParticipationStatistics,
  InitiativePublicImpactReportSection,
} from "@hu/types";

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
  return (
    <article className="ipi-public" aria-label="Public Impact Report">
      {metaLabel ? <p className="ipi-public__meta">{metaLabel}</p> : null}
      <section className="ipi-public__section">
        <h3>{title || "Untitled Public Impact Report"}</h3>
        <p className="ipi-public__meta">
          Signatures {participationStatistics.signatureCount} · Support{" "}
          {participationStatistics.supportCount} · Reactions {participationStatistics.reactionCount} ·
          Allies {participationStatistics.activeAllyCount}
        </p>
      </section>
      {sections.map((section) => (
        <section className="ipi-public__section" key={section.sectionId}>
          <h3>{section.title || section.sectionId}</h3>
          {section.body.trim() ? (
            <p style={{ whiteSpace: "pre-wrap" }}>{section.body}</p>
          ) : (
            <p className="ipi-public__meta">No content yet.</p>
          )}
          {section.evidenceReferences.length > 0 ? (
            <p className="ipi-public__meta">
              Evidence: {section.evidenceReferences.join(" · ")}
            </p>
          ) : null}
        </section>
      ))}
    </article>
  );
}
