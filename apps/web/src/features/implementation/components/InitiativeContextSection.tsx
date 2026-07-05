import type {
  CollectiveDecision,
  Implementation,
  ImplementationCommitment,
  Initiative,
  Petition,
} from "@hu/types";

import { ProfileField } from "../../../components/member/ProfileField";

import {
  PIPELINE_STAGES,
  formatImplementationDate,
  getLifecycleSummary,
  getPipelineStageStatus,
} from "../implementation-utils";

interface InitiativeContextSectionProps {
  implementation: Implementation;
  initiative: Initiative | null;
  collectiveDecision: CollectiveDecision | null;
  petition: Petition | null;
  commitment: ImplementationCommitment | null;
}

export function InitiativeContextSection({
  implementation,
  initiative,
  collectiveDecision,
  petition,
  commitment,
}: InitiativeContextSectionProps) {
  return (
    <div className="implementation-initiative-context">
      <p className="implementation-section__intro">
        You are in the Implementation stage of the Collective Participation Journey. This stage
        asks: what is being done collectively toward an approved direction?
      </p>

      <ul className="implementation-status__pipeline" aria-label="Participation pipeline">
        {PIPELINE_STAGES.map((stage) => (
          <li key={stage} className="implementation-status__pipeline-item">
            <span className="implementation-status__pipeline-stage">{stage}</span>
            <span className="implementation-status__pipeline-state">
              {getPipelineStageStatus(stage)}
            </span>
          </li>
        ))}
      </ul>

      <ProfileField label="Subject Title" value={implementation.subjectTitle} />
      <ProfileField label="Subject Summary" value={implementation.subjectSummary} />
      <ProfileField label="Lifecycle State" value={implementation.status} />
      <ProfileField label="Recording Status" value={getLifecycleSummary(implementation.status)} />
      <ProfileField label="Created" value={formatImplementationDate(implementation.createdAt)} />
      <ProfileField label="Initiative" value={initiative?.title ?? implementation.initiativeId} />
      <ProfileField
        label="Collective Decision"
        value={collectiveDecision?.decisionId ?? implementation.collectiveDecisionId}
      />
      <ProfileField
        label="Related Petition"
        value={petition?.petitionId ?? implementation.petitionId}
      />
      <ProfileField
        label="Implementation Commitment"
        value={commitment?.subjectTitle ?? implementation.implementationCommitmentId}
      />
      <p className="implementation-section__note">
        This record continues the approved civic direction. It does not reopen collective
        decision-making, petition endorsement or commitment declaration.
      </p>
    </div>
  );
}
