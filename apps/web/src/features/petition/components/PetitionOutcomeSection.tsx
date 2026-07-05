import type { Petition } from "@hu/types";

import { ProfileField } from "../../../components/member/ProfileField";

interface PetitionOutcomeSectionProps {
  petition: Petition;
}

const VISIBLE_STATUSES = new Set<Petition["status"]>(["Closed", "Archived"]);

export function PetitionOutcomeSection({ petition }: PetitionOutcomeSectionProps) {
  if (!VISIBLE_STATUSES.has(petition.status)) {
    return (
      <p className="petition-outcome__empty">
        Final Petition Outcome will appear after the endorsement period closes.
      </p>
    );
  }

  if (!petition.outcome) {
    return <p className="petition-outcome__empty">Petition Outcome is not yet available.</p>;
  }

  return (
    <div className="petition-outcome">
      <ProfileField label="Outcome Type" value={petition.outcome.outcomeType} />
      <ProfileField label="Explanation" value={petition.outcome.explanation} />
      <ProfileField
        label="Final Support Count"
        value={String(petition.supportMetrics.totalSignatures)}
      />
      {petition.supportMetrics.supportThresholdStatus.thresholdDefined ? (
        <ProfileField
          label="Threshold Status"
          value={
            petition.supportMetrics.supportThresholdStatus.thresholdReached
              ? "Threshold reached"
              : "Threshold not reached"
          }
        />
      ) : null}
    </div>
  );
}
