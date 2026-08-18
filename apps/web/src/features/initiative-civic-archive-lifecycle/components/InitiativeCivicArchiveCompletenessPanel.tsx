"use client";

import type {
  InitiativeCivicArchiveCompleteness,
  InitiativeLifecycleProfile,
} from "@hu/types";

import { requiresPublicImpactBeforeCivicArchive } from "../../public-initiative-experience/initiative-lifecycle-shell";

export function InitiativeCivicArchiveCompletenessPanel({
  completeness,
  lifecycleProfile,
}: {
  readonly completeness: InitiativeCivicArchiveCompleteness;
  readonly lifecycleProfile?: InitiativeLifecycleProfile | string | null;
}) {
  const requirePublicImpact = requiresPublicImpactBeforeCivicArchive(lifecycleProfile);

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
            {requirePublicImpact
              ? `${completeness.publicImpactAvailable ? "Available" : "Not available"}${
                  completeness.traceabilityComplete
                    ? " · Traceability complete"
                    : " · Traceability incomplete"
                }`
              : "Not applicable on Public Choice — Collective Decision completion is sufficient"}
          </p>
        </li>
      </ul>
    </section>
  );
}
