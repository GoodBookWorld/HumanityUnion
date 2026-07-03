import type { ImplementationCommitment } from "@hu/types";

import { ProfileField } from "../../../components/member/ProfileField";

interface ImplementationReadinessSectionProps {
  commitment: ImplementationCommitment;
}

export function ImplementationReadinessSection({
  commitment,
}: ImplementationReadinessSectionProps) {
  const { implementationReadiness } = commitment;

  return (
    <div className="commitment-readiness">
      <p className="commitment-section__derived">
        Derived value — computed from Community Capacity and Frozen Policy. Never manually set.
      </p>
      <ProfileField
        label="Readiness Reached"
        value={implementationReadiness.readinessReached ? "Yes" : "Not yet"}
      />
      <ProfileField label="Explanation" value={implementationReadiness.explanation} />
      <ProfileField
        label="Required Thresholds Satisfied"
        value={String(implementationReadiness.satisfiedThresholds.length)}
      />
      <ProfileField
        label="Required Thresholds Pending"
        value={String(implementationReadiness.unsatisfiedThresholds.length)}
      />
      <ProfileField
        label="Derived At"
        value={new Date(implementationReadiness.derivedAt).toLocaleString()}
      />
      <p className="commitment-section__note">
        Implementation Readiness is not approval of the Collective Decision. It reflects how
        closely declared Community Capacity satisfies Frozen Policy thresholds.
      </p>
    </div>
  );
}
