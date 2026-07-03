import type { Petition } from "@hu/types";

import { ProfileField } from "../../../components/member/ProfileField";

import {
  PIPELINE_STAGES,
  formatPetitionDate,
  getPipelineStageStatus,
  getSupportStatusSummary,
} from "../petition-utils";

interface PetitionStatusProps {
  petition: Petition;
}

export function PetitionStatus({ petition }: PetitionStatusProps) {
  const { policy, shareLink, status, subject } = petition;

  return (
    <div className="petition-status">
      <p className="petition-status__intro">
        You are in the Petition stage of the Collective Participation Journey.
      </p>

      <ul className="petition-status__pipeline" aria-label="Participation pipeline">
        {PIPELINE_STAGES.map((stage) => (
          <li key={stage} className="petition-status__pipeline-item">
            <span className="petition-status__pipeline-stage">{stage}</span>
            <span className="petition-status__pipeline-state">
              {getPipelineStageStatus(stage)}
            </span>
          </li>
        ))}
      </ul>

      <ProfileField label="Petition Title" value={subject.title} />
      <ProfileField label="Lifecycle State" value={status} />
      <ProfileField label="Support Status" value={getSupportStatusSummary(status)} />
      <ProfileField label="Created" value={formatPetitionDate(petition.createdAt)} />
      <ProfileField
        label="Opening Date"
        value={formatPetitionDate(policy.endorsementPeriod.opensAt)}
      />
      <ProfileField
        label="Closing Date"
        value={formatPetitionDate(policy.endorsementPeriod.closesAt)}
      />
      <ProfileField
        label="Share Link"
        value={
          shareLink
            ? shareLink.url
            : status === "Published" ||
                status === "Open" ||
                status === "Closed" ||
                status === "Archived"
              ? "Not available"
              : "Available after publication"
        }
      />
    </div>
  );
}
