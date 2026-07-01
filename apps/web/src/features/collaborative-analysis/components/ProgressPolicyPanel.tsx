import type { ProgressPolicy } from "@hu/types";

import { ProfileField } from "../../../components/member/ProfileField";

import "./progress-policy-panel.css";

interface ProgressPolicyPanelProps {
  progressPolicy: ProgressPolicy;
}

function formatBoolean(value: boolean): string {
  return value ? "Required" : "Not required";
}

export function ProgressPolicyPanel({ progressPolicy }: ProgressPolicyPanelProps) {
  return (
    <div className="progress-policy-panel">
      <ProfileField
        label="Required Contributions"
        value={String(progressPolicy.minimumContributions)}
      />
      <ProfileField label="Required Signals" value={String(progressPolicy.minimumSignals)} />
      <ProfileField
        label="Participant Threshold"
        value={String(progressPolicy.minimumParticipantCount)}
      />
      <ProfileField
        label="Expert Review"
        value={formatBoolean(progressPolicy.expertReviewRequired)}
      />
      <ProfileField
        label="Regional Review"
        value={formatBoolean(progressPolicy.regionalReviewRequired)}
      />
    </div>
  );
}
