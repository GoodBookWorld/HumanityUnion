import type { CollectiveDecision } from "@hu/types";

import { ProfileField } from "../../../components/member/ProfileField";

import "./outcome-panel.css";

interface OutcomePanelProps {
  decision: CollectiveDecision;
}

const VISIBLE_STATUSES = new Set<CollectiveDecision["status"]>(["Completed", "Archived"]);

export function OutcomePanel({ decision }: OutcomePanelProps) {
  if (!VISIBLE_STATUSES.has(decision.status) || !decision.outcome) {
    return (
      <p className="outcome-panel__empty">Outcome will appear after the decision is completed.</p>
    );
  }

  return (
    <div className="outcome-panel">
      <ProfileField label="Outcome" value={decision.outcome.outcomeType} />
      <ProfileField label="Next Stage" value={decision.outcome.nextLifecycleStage} />
      <ProfileField label="Explanation" value={decision.outcome.explanation} />
    </div>
  );
}
