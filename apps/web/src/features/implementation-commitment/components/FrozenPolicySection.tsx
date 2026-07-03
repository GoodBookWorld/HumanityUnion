import type { ImplementationCommitment } from "@hu/types";

import { ProfileField } from "../../../components/member/ProfileField";

import { getPolicyRequirementGroups } from "../commitment-utils";

interface FrozenPolicySectionProps {
  commitment: ImplementationCommitment;
}

export function FrozenPolicySection({ commitment }: FrozenPolicySectionProps) {
  const { satisfied, pending, optional } = getPolicyRequirementGroups(commitment);

  return (
    <div className="commitment-frozen-policy">
      <p className="commitment-section__note">
        Frozen Policy is read-only in this workspace. Policy content cannot be modified here.
      </p>
      <ProfileField label="Policy Reference" value={commitment.frozenPolicyId} />

      <h3 className="commitment-policy__group-title">Satisfied</h3>
      {satisfied.length > 0 ? (
        <ul className="commitment-policy__list">
          {satisfied.map((item) => (
            <li key={item.thresholdId}>{item.description}</li>
          ))}
        </ul>
      ) : (
        <p className="commitment-section__empty">No required thresholds satisfied yet.</p>
      )}

      <h3 className="commitment-policy__group-title">Pending</h3>
      {pending.length > 0 ? (
        <ul className="commitment-policy__list">
          {pending.map((item) => (
            <li key={item.thresholdId}>{item.description}</li>
          ))}
        </ul>
      ) : (
        <p className="commitment-section__empty">All required thresholds are satisfied.</p>
      )}

      <h3 className="commitment-policy__group-title">Optional</h3>
      {optional.length > 0 ? (
        <ul className="commitment-policy__list">
          {optional.map((item) => (
            <li key={item.thresholdId}>{item.description}</li>
          ))}
        </ul>
      ) : (
        <p className="commitment-section__empty">No optional requirements defined.</p>
      )}
    </div>
  );
}
