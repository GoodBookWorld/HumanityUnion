import type { CollectiveDecision } from "@hu/types";

import { ProfileField } from "../../../components/member/ProfileField";

import "./ballot.css";

interface BallotProps {
  decision: CollectiveDecision;
}

export function BallotPanel({ decision }: BallotProps) {
  const { ballot } = decision;

  return (
    <div className="ballot">
      <ProfileField label="Question" value={ballot.question} />
      <div className="ballot__options">
        <p className="ballot__options-label">Available Options</p>
        <ul className="ballot__options-list">
          {ballot.options.map((option) => (
            <li key={option.optionId}>
              <strong>{option.label}</strong> — {option.description}
            </li>
          ))}
        </ul>
      </div>
      <ProfileField
        label="Decision Rules Summary"
        value={`Quorum ${ballot.decisionRules.quorumRequired}, approval threshold ${ballot.decisionRules.approvalThreshold}%, ${ballot.decisionRules.winningMethod}`}
      />
    </div>
  );
}
