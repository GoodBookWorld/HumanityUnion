import type { CollaborativeAnalysis, CollectiveDecision, Initiative } from "@hu/types";

import { ProfileField } from "../../../components/member/ProfileField";

interface DecisionContextProps {
  collectiveDecision: CollectiveDecision | null;
  initiative: Initiative | null;
  collaborativeAnalysis: CollaborativeAnalysis | null;
}

function formatAnalysisReadiness(analysis: CollaborativeAnalysis | null): string {
  if (!analysis) {
    return "Not available";
  }

  return `${analysis.readiness.readinessScore}% ready`;
}

export function DecisionContext({
  collectiveDecision,
  initiative,
  collaborativeAnalysis,
}: DecisionContextProps) {
  if (!collectiveDecision) {
    return (
      <p className="decision-context__empty">
        Collective Decision context is unavailable. Review the Petition subject before signing.
      </p>
    );
  }

  const approvedOption =
    collectiveDecision.decisionResult?.winningOptionId !== undefined &&
    collectiveDecision.decisionResult.winningOptionId !== null
      ? (collectiveDecision.ballot.options.find(
          (option) => option.optionId === collectiveDecision.decisionResult?.winningOptionId,
        )?.label ?? "Unknown")
      : null;

  return (
    <div className="decision-context">
      <ProfileField label="Decision Question" value={collectiveDecision.ballot.question} />
      <ProfileField label="Decision Status" value={collectiveDecision.status} />
      <ProfileField label="Approved Result" value={approvedOption ?? "Result not yet available"} />
      <ProfileField
        label="Collective Decision Outcome"
        value={collectiveDecision.outcome?.outcomeType ?? "Outcome not yet available"}
      />
      <ProfileField
        label="Outcome Explanation"
        value={collectiveDecision.outcome?.explanation ?? "Not available"}
      />
      <ProfileField
        label="Initiative Context"
        value={initiative?.description ?? "Initiative details are not available."}
      />
      <ProfileField
        label="Analysis Readiness"
        value={formatAnalysisReadiness(collaborativeAnalysis)}
      />
      <p className="decision-context__note">
        This summary supports informed endorsement. It does not reopen ballot participation.
      </p>
    </div>
  );
}
