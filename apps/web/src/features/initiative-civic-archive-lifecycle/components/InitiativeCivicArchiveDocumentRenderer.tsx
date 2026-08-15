"use client";

import type { InitiativeLifecycleArchiveDocument } from "@hu/types";

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
  return (
    <article className="ica-public" aria-label="Civic Archive Document">
      {metaLabel ? <p className="ica-public__meta">{metaLabel}</p> : null}
      <section className="ica-public__section">
        <h3>{document.finalArchiveTitle || "Untitled Civic Archive"}</h3>
        <p className="ica-public__meta">
          {document.archiveVersion != null
            ? `Version ${document.archiveVersion}`
            : "Draft preview"}
          {document.publishedAt ? ` · Published ${document.publishedAt}` : ""}
        </p>
        {document.finalSummary.trim() ? (
          <p style={{ whiteSpace: "pre-wrap" }}>{document.finalSummary}</p>
        ) : null}
        <p className="ica-public__meta">
          Signatures {document.participationStatistics.signatureCount} · Support{" "}
          {document.participationStatistics.supportCount} · Reactions{" "}
          {document.participationStatistics.reactionCount} · Allies{" "}
          {document.participationStatistics.activeAllyCount}
        </p>
      </section>

      <section className="ica-public__section">
        <h3>Lifecycle Timeline</h3>
        <ul className="ica-source-panel__list">
          {document.timeline.map((entry) => (
            <li className="ica-source-panel__item" key={entry.stageId}>
              <span className="ica-source-panel__label">{entry.label}</span>
              <p className="ica-source-panel__summary">
                {entry.status}
                {entry.publishedAt ? ` · ${entry.publishedAt}` : ""}
                {entry.version != null ? ` · v${entry.version}` : ""}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {document.sections.map((section) => (
        <section className="ica-public__section" key={section.sectionId} id={section.sectionId}>
          <h3>{section.title || section.sectionId}</h3>
          {section.body.trim() ? (
            <p style={{ whiteSpace: "pre-wrap" }}>{section.body}</p>
          ) : (
            <p className="ica-public__meta">No content recorded.</p>
          )}
          {section.sourceRecordIds.length > 0 ? (
            <p className="ica-public__meta">Sources: {section.sourceRecordIds.join(" · ")}</p>
          ) : null}
        </section>
      ))}

      <section className="ica-public__section">
        <h3>Completeness</h3>
        <p style={{ whiteSpace: "pre-wrap" }}>{document.completeness.summary}</p>
      </section>

      <p className="ica-public__meta">{document.disclaimer}</p>
    </article>
  );
}
