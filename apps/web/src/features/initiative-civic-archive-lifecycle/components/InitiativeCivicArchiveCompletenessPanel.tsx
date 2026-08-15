"use client";

import type { InitiativeCivicArchiveCompleteness } from "@hu/types";

export function InitiativeCivicArchiveCompletenessPanel({
  completeness,
}: {
  readonly completeness: InitiativeCivicArchiveCompleteness;
}) {
  return (
    <section className="ica-source-panel" aria-label="Archive Completeness">
      <ul className="ica-source-panel__list">
        <li className="ica-source-panel__item">
          <span className="ica-source-panel__label">Summary</span>
          <p className="ica-source-panel__summary">{completeness.summary}</p>
        </li>
        <li className="ica-source-panel__item">
          <span className="ica-source-panel__label">Stages Published</span>
          <p className="ica-source-panel__summary">
            {completeness.stagesPublished.length > 0
              ? completeness.stagesPublished.join(", ")
              : "None yet"}
          </p>
        </li>
        <li className="ica-source-panel__item">
          <span className="ica-source-panel__label">Missing Optional Stages</span>
          <p className="ica-source-panel__summary">
            {completeness.missingOptionalStages.length > 0
              ? completeness.missingOptionalStages.join(", ")
              : "None"}
          </p>
        </li>
        <li className="ica-source-panel__item">
          <span className="ica-source-panel__label">Outstanding Work</span>
          <p className="ica-source-panel__summary">
            {completeness.unresolvedTrackingCount} unresolved tracking ·{" "}
            {completeness.unfinishedCommitmentCount} unfinished commitment(s) ·{" "}
            {completeness.missingEvidenceCount} missing evidence
          </p>
        </li>
        <li className="ica-source-panel__item">
          <span className="ica-source-panel__label">Public Impact</span>
          <p className="ica-source-panel__summary">
            {completeness.publicImpactAvailable ? "Available" : "Not available"}
            {completeness.traceabilityComplete ? " · Traceability complete" : " · Traceability incomplete"}
          </p>
        </li>
      </ul>
    </section>
  );
}
