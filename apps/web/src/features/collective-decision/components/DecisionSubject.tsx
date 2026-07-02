import type { CollectiveDecision, Initiative } from "@hu/types";

import { ProfileField } from "../../../components/member/ProfileField";

import "./decision-subject.css";

interface DecisionSubjectProps {
  decision: CollectiveDecision;
  initiativeSubject?: Initiative | null;
}

function formatLifecycleStage(status: Initiative["status"]): string {
  return status.replace(/_/g, " ");
}

export function DecisionSubject({ decision, initiativeSubject = null }: DecisionSubjectProps) {
  if (decision.decisionSubjectType === "Initiative") {
    if (!initiativeSubject) {
      return (
        <div className="decision-subject">
          <ProfileField label="Subject Type" value={decision.decisionSubjectType} />
          <p className="decision-subject__empty">Initiative details are not available.</p>
        </div>
      );
    }

    return (
      <div className="decision-subject">
        <ProfileField label="Initiative Title" value={initiativeSubject.title} />
        <ProfileField label="Initiative Summary" value={initiativeSubject.description} />
        <ProfileField
          label="Lifecycle Stage"
          value={formatLifecycleStage(initiativeSubject.status)}
        />
      </div>
    );
  }

  return (
    <div className="decision-subject">
      <ProfileField label="Subject Type" value={decision.decisionSubjectType} />
      <ProfileField label="Subject Reference" value={decision.decisionSubjectId} />
    </div>
  );
}
