import type { CommitmentContributionType, FrozenPolicyId } from "@hu/types";

export interface ReadinessThresholdFixture {
  thresholdId: string;
  description: string;
  contributionType?: CommitmentContributionType;
  minimumCount?: number;
  minimumCapacity?: number;
  requiredSkillLabel?: string;
  optional?: boolean;
}

/** Read-only Frozen Policy fixture — external to Implementation Commitment aggregate. */
export interface FrozenPolicyFixture {
  frozenPolicyId: FrozenPolicyId;
  label: string;
  thresholds: ReadinessThresholdFixture[];
  allowRemovalInActive: boolean;
  allowWithdrawal: boolean;
}

export const bootstrapFrozenPolicyId = "frozen-policy-bootstrap-001";

export const bootstrapFrozenPolicy: FrozenPolicyFixture = {
  frozenPolicyId: bootstrapFrozenPolicyId,
  label: "Community Garden Implementation Commitment Policy",
  allowRemovalInActive: false,
  allowWithdrawal: true,
  thresholds: [
    {
      thresholdId: "threshold-coordinator",
      description: "One coordinator needed",
      contributionType: "Professional",
      minimumCount: 1,
      requiredSkillLabel: "Coordinator",
    },
    {
      thresholdId: "threshold-translator",
      description: "Two translators needed",
      contributionType: "Volunteer",
      minimumCount: 2,
      requiredSkillLabel: "Translator",
    },
    {
      thresholdId: "threshold-volunteer-base",
      description: "Three volunteer contributors needed",
      contributionType: "Volunteer",
      minimumCount: 3,
    },
    {
      thresholdId: "threshold-facility",
      description: "Meeting venue or facility resource",
      contributionType: "Resource",
      minimumCount: 1,
      requiredSkillLabel: "Facility",
      optional: true,
    },
  ],
};

const frozenPolicies = new Map<string, FrozenPolicyFixture>([
  [bootstrapFrozenPolicy.frozenPolicyId, structuredClone(bootstrapFrozenPolicy)],
]);

export function getFrozenPolicy(frozenPolicyId: FrozenPolicyId): FrozenPolicyFixture | null {
  const policy = frozenPolicies.get(frozenPolicyId);

  return policy ? structuredClone(policy) : null;
}

export function listFrozenPolicies(): FrozenPolicyFixture[] {
  return Array.from(frozenPolicies.values(), (policy) => structuredClone(policy));
}
