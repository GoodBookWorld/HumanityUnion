import type { Implementation } from "@hu/types";

import { ProfileField } from "../../../components/member/ProfileField";

import { getLifecycleSummary, getStatusRecordingSummary } from "../implementation-utils";

interface ImplementationStatusSectionProps {
  implementation: Implementation;
}

export function ImplementationStatusSection({ implementation }: ImplementationStatusSectionProps) {
  return (
    <div className="implementation-status">
      <p className="implementation-section__derived">
        Lifecycle status is authoritative aggregate state. Derived progress and completion are shown
        separately and cannot be edited here.
      </p>
      <ProfileField label="Lifecycle State" value={implementation.status} />
      <ProfileField label="Lifecycle Meaning" value={getLifecycleSummary(implementation.status)} />
      <ProfileField
        label="Recording Status Summary"
        value={getStatusRecordingSummary(implementation.status)}
      />
      <ProfileField
        label="Derived Progress Headline"
        value={implementation.progressIndicator.headline}
      />
      <ProfileField
        label="Derived Completion Headline"
        value={implementation.completionIndicator.headline}
      />
      <p className="implementation-section__note">
        Lifecycle transitions occur only through authorized operational commands — not through
        workspace controls.
      </p>
    </div>
  );
}
