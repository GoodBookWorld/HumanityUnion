import type { ImplementationCommitment } from "@hu/types";

import { ProfileField } from "../../../components/member/ProfileField";

interface CommunityCapacitySectionProps {
  commitment: ImplementationCommitment;
}

export function CommunityCapacitySection({ commitment }: CommunityCapacitySectionProps) {
  const { communityCapacity } = commitment;

  return (
    <div className="commitment-capacity">
      <p className="commitment-section__derived">
        Derived value — aggregated from recorded Contribution Items only. Never manually edited.
      </p>
      <ProfileField
        label="Active Declarations"
        value={String(communityCapacity.totalContributions)}
      />
      <ProfileField
        label="Volunteers"
        value={String(communityCapacity.contributionsByType.Volunteer)}
      />
      <ProfileField
        label="Professional Capacity"
        value={String(communityCapacity.contributionsByType.Professional)}
      />
      <ProfileField
        label="Resources"
        value={String(communityCapacity.contributionsByType.Resource)}
      />
      <ProfileField
        label="Availability Summary"
        value={communityCapacity.aggregateAvailabilitySummary}
      />
      <ProfileField label="Skill Coverage" value={communityCapacity.skillCoverageSummary} />
      <ProfileField
        label="Derived At"
        value={new Date(communityCapacity.derivedAt).toLocaleString()}
      />
      <p className="commitment-section__note">
        Community Capacity describes declared preparedness — not completed implementation work.
      </p>
    </div>
  );
}
