import type { LatestInitiativesPublicProjection } from "@hu/types";

import { LatestInitiativeCard } from "./LatestInitiativeCard";

interface LatestInitiativesEvidenceProps {
  projection: LatestInitiativesPublicProjection;
  emptyMessage: string;
}

export function LatestInitiativesEvidence({
  projection,
  emptyMessage,
}: LatestInitiativesEvidenceProps) {
  return (
    <div className="latest-global-initiatives">
      <p className="latest-global-initiatives__scope">
        Scope: {projection.scopeLabel}
        {projection.source === "bootstrap" ? (
          <span className="latest-global-initiatives__source"> · Bootstrap demonstration data</span>
        ) : null}
      </p>

      {projection.initiatives.length > 0 ? (
        <ul className="latest-global-initiatives__list">
          {projection.initiatives.map((initiative) => (
            <li key={initiative.initiativeId}>
              <LatestInitiativeCard initiative={initiative} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="latest-global-initiatives__empty">{emptyMessage}</p>
      )}
    </div>
  );
}
