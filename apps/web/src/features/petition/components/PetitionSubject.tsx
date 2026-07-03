import type { Petition } from "@hu/types";

import { ProfileField } from "../../../components/member/ProfileField";

interface PetitionSubjectProps {
  petition: Petition;
}

export function PetitionSubject({ petition }: PetitionSubjectProps) {
  const { subject } = petition;

  return (
    <div className="petition-subject">
      <ProfileField label="Initiative Title" value={subject.title} />
      <ProfileField label="Initiative Summary" value={subject.summary} />
      <ProfileField
        label="Approved Collective Decision"
        value={subject.decisionId}
      />
      <p className="petition-subject__note">
        Endorsement follows an approved Collective Decision. Signing supports the approved
        direction; it does not reopen the decision.
      </p>
    </div>
  );
}
