import type { ImplementationCommitment } from "@hu/types";

import { BOOTSTRAP_PARTICIPANT_ID, deriveAssistantGuidance } from "../commitment-utils";

interface HumanityAssistantPanelProps {
  commitment: ImplementationCommitment;
}

export function HumanityAssistantPanel({ commitment }: HumanityAssistantPanelProps) {
  const guidance = deriveAssistantGuidance(commitment, BOOTSTRAP_PARTICIPANT_ID);

  return (
    <div className="commitment-assistant">
      <p className="commitment-assistant__summary">{guidance.summary}</p>
      <ul className="commitment-policy__list">
        {guidance.highlights.map((highlight) => (
          <li key={highlight}>{highlight}</li>
        ))}
      </ul>
      <p className="commitment-assistant__suggestion">
        <strong>Suggested understanding: </strong>
        {guidance.suggestion}
      </p>
      <p className="commitment-section__note">
        This assistant explains and suggests only. It never decides, persuades, creates, or modifies
        commitments.
      </p>
    </div>
  );
}
