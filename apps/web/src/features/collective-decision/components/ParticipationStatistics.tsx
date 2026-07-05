import type { CollectiveDecision } from "@hu/types";

import { ProfileField } from "../../../components/member/ProfileField";

import "./participation-statistics.css";

interface ParticipationStatisticsProps {
  decision: CollectiveDecision;
}

export function ParticipationStatistics({ decision }: ParticipationStatisticsProps) {
  const { statistics } = decision;

  return (
    <div className="participation-statistics">
      <ProfileField
        label="Eligible Participants"
        value={String(statistics.eligibleParticipantCount)}
      />
      <ProfileField label="Submitted Decisions" value={String(statistics.submittedDecisionCount)} />
      <ProfileField label="Participation Rate" value={`${statistics.participationRate}%`} />
      <ProfileField label="Completion Rate" value={`${statistics.completionRate}%`} />
    </div>
  );
}
