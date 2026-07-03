import type {
  CollectiveDecision,
  ImplementationCommitment,
  Initiative,
  Petition,
} from "@hu/types";

import { ProfileField } from "../../../components/member/ProfileField";

import {
  PIPELINE_STAGES,
  formatCommitmentDate,
  getLifecycleSummary,
  getPipelineStageStatus,
} from "../commitment-utils";

interface InitiativeContextSectionProps {
  commitment: ImplementationCommitment;
  initiative: Initiative | null;
  collectiveDecision: CollectiveDecision | null;
  petition: Petition | null;
}

export function InitiativeContextSection({
  commitment,
  initiative,
  collectiveDecision,
  petition,
}: InitiativeContextSectionProps) {
  return (
    <div className="commitment-initiative-context">
      <p className="commitment-section__intro">
        You are in the Implementation Commitment stage of the Collective Participation Journey.
        This stage asks: who is prepared to help implement an approved direction?
      </p>

      <ul className="commitment-status__pipeline" aria-label="Participation pipeline">
        {PIPELINE_STAGES.map((stage) => (
          <li key={stage} className="commitment-status__pipeline-item">
            <span className="commitment-status__pipeline-stage">{stage}</span>
            <span className="commitment-status__pipeline-state">
              {getPipelineStageStatus(stage)}
            </span>
          </li>
        ))}
      </ul>

      <ProfileField label="Subject Title" value={commitment.subjectTitle} />
      <ProfileField label="Subject Summary" value={commitment.subjectSummary} />
      <ProfileField label="Lifecycle State" value={commitment.status} />
      <ProfileField label="Collection Status" value={getLifecycleSummary(commitment.status)} />
      <ProfileField label="Created" value={formatCommitmentDate(commitment.createdAt)} />
      <ProfileField
        label="Initiative"
        value={initiative?.title ?? commitment.initiativeId}
      />
      <ProfileField
        label="Collective Decision"
        value={collectiveDecision?.decisionId ?? commitment.collectiveDecisionId}
      />
      <ProfileField label="Related Petition" value={petition?.petitionId ?? commitment.petitionId} />
      <p className="commitment-section__note">
        Endorsement through the Petition stage is separate from declaring implementation
        preparedness here.
      </p>
    </div>
  );
}
