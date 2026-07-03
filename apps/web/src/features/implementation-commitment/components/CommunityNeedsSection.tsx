import type { ImplementationCommitment } from "@hu/types";

import { getCommunityNeeds } from "../commitment-utils";

interface CommunityNeedsSectionProps {
  commitment: ImplementationCommitment;
}

export function CommunityNeedsSection({ commitment }: CommunityNeedsSectionProps) {
  const needs = getCommunityNeeds(commitment);

  return (
    <div className="commitment-community-needs">
      <p className="commitment-section__note">
        Community Needs show missing required capacity only. They describe requirements — not
        assigned tasks.
      </p>

      {needs.length > 0 ? (
        <ul className="commitment-policy__list">
          {needs.map((need) => (
            <li key={need.thresholdId}>{need.description}</li>
          ))}
        </ul>
      ) : (
        <p className="commitment-section__empty">
          {commitment.status === "Active"
            ? "All required Community Needs are currently satisfied by declared capacity."
            : "Community Needs appear when collection is active and capacity gaps exist."}
        </p>
      )}
    </div>
  );
}
