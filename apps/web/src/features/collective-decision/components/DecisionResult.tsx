import type { CollectiveDecision } from "@hu/types";

import { ProfileField } from "../../../components/member/ProfileField";

import "./decision-result.css";

interface DecisionResultPanelProps {
  decision: CollectiveDecision;
}

const VISIBLE_STATUSES = new Set<CollectiveDecision["status"]>(["Closed", "Completed", "Archived"]);

function formatOptionLabel(decision: CollectiveDecision, optionId: string | null): string {
  if (!optionId) {
    return "None";
  }

  return decision.ballot.options.find((option) => option.optionId === optionId)?.label ?? optionId;
}

export function DecisionResultPanel({ decision }: DecisionResultPanelProps) {
  if (!VISIBLE_STATUSES.has(decision.status) || !decision.decisionResult) {
    return (
      <p className="decision-result__empty">
        Decision Result will appear after the decision closes.
      </p>
    );
  }

  const { decisionResult } = decision;

  return (
    <div className="decision-result">
      <ProfileField label="Participation Rate" value={`${decisionResult.participationRate}%`} />
      <ProfileField
        label="Winning Option"
        value={formatOptionLabel(decision, decisionResult.winningOptionId)}
      />
      <ProfileField
        label="Quorum Status"
        value={decisionResult.quorumSatisfied ? "Satisfied" : "Not satisfied"}
      />
      <ul className="decision-result__totals">
        {decisionResult.optionResults.map((result) => (
          <li key={result.optionId}>
            {formatOptionLabel(decision, result.optionId)}: {result.count} ({result.percentage}
            %)
          </li>
        ))}
      </ul>
    </div>
  );
}
