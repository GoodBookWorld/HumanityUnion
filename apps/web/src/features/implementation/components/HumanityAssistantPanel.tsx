import type { Implementation } from "@hu/types";

import { deriveAssistantGuidance } from "../implementation-utils";

interface HumanityAssistantPanelProps {
  implementation: Implementation;
}

export function HumanityAssistantPanel({ implementation }: HumanityAssistantPanelProps) {
  const guidance = deriveAssistantGuidance(implementation);

  if (
    implementation.status === "Planned" &&
    implementation.achievements.length === 0 &&
    implementation.implementationPhases.length === 0
  ) {
    return (
      <div className="implementation-assistant">
        <p className="implementation-assistant__summary">
          This implementation record is still preparing. The assistant can explain lifecycle meaning
          and what will appear as achievements are recorded.
        </p>
        <p className="implementation-section__note">
          This assistant explains only. It never decides, records, coordinates or assigns work.
        </p>
      </div>
    );
  }

  return (
    <div className="implementation-assistant">
      <p className="implementation-assistant__summary">{guidance.summary}</p>
      <ul className="implementation-assistant__list">
        {guidance.highlights.map((highlight) => (
          <li key={highlight}>{highlight}</li>
        ))}
      </ul>
      <p className="implementation-assistant__suggestion">
        <strong>Suggested understanding: </strong>
        {guidance.suggestion}
      </p>
      <p className="implementation-section__note">
        This assistant explains implementation status, progress, achievements and evidence. It never
        approves achievements, coordinates work, assigns tasks or recommends work.
      </p>
    </div>
  );
}
