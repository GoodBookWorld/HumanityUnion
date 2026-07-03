import type {
  Availability,
  CommitmentContributionType,
  CommitmentState,
  CommunityCapacity,
  ContributionItem,
  ContributionProfile,
  ContributionSummary,
  ImplementationCommitment,
  ImplementationReadiness,
  ParticipantId,
  PolicySatisfaction,
} from "@hu/types";

import {
  bootstrapFrozenPolicy,
  getFrozenPolicy,
  type FrozenPolicyFixture,
  type ReadinessThresholdFixture,
} from "./frozen-policy.fixture.js";

const ALLOWED_TRANSITIONS: Record<CommitmentState, CommitmentState[]> = {
  Draft: ["Submitted"],
  Submitted: ["Active"],
  Active: ["Completed", "Withdrawn"],
  Withdrawn: ["Archived"],
  Completed: ["Archived"],
  Archived: [],
};

const PREPARATORY_STATES: CommitmentState[] = ["Draft", "Submitted"];

const PROFILE_UPDATE_STATES: CommitmentState[] = ["Draft", "Submitted", "Active"];

export function cloneImplementationCommitment(
  commitment: ImplementationCommitment,
): ImplementationCommitment {
  return structuredClone(commitment);
}

export function assertValidTransition(
  currentStatus: CommitmentState,
  nextStatus: CommitmentState,
): void {
  const allowed = ALLOWED_TRANSITIONS[currentStatus];

  if (!allowed.includes(nextStatus)) {
    throw new Error(`Transition from "${currentStatus}" to "${nextStatus}" is not allowed.`);
  }
}

export function assertMutableCommitment(status: CommitmentState): void {
  if (status === "Archived") {
    throw new Error("Archived Implementation Commitments are read-only.");
  }
}

export function assertPreparatoryCommitment(status: CommitmentState): void {
  if (!PREPARATORY_STATES.includes(status)) {
    throw new Error("Only Draft or Submitted commitments can be updated in preparatory mode.");
  }
}

export function assertProfileUpdateAllowed(status: CommitmentState): void {
  if (!PROFILE_UPDATE_STATES.includes(status)) {
    throw new Error("Contribution Profile updates are not permitted in this lifecycle state.");
  }
}

export function getActiveContributionItems(
  commitment: ImplementationCommitment,
): ContributionItem[] {
  return commitment.contributionItems.filter((item) => item.commitmentStatus === "Declared");
}

export function hasActiveContributionForParticipant(
  commitment: ImplementationCommitment,
  participantId: ParticipantId,
): boolean {
  return getActiveContributionItems(commitment).some(
    (item) => item.participantId === participantId,
  );
}

export function createEmptyContributionsByType(): Record<CommitmentContributionType, number> {
  return {
    Volunteer: 0,
    Professional: 0,
    Resource: 0,
  };
}

export function createEmptyCommunityCapacity(now = new Date().toISOString()): CommunityCapacity {
  return {
    totalContributions: 0,
    contributionsByType: createEmptyContributionsByType(),
    aggregateAvailabilitySummary: "No active declarations recorded.",
    skillCoverageSummary: "No skill coverage recorded.",
    derivedAt: now,
  };
}

export function createEmptyImplementationReadiness(
  now = new Date().toISOString(),
): ImplementationReadiness {
  return {
    readinessReached: false,
    satisfiedThresholds: [],
    unsatisfiedThresholds: [],
    derivedAt: now,
    explanation: "Implementation Readiness will be derived when collection is active.",
  };
}

export function createEmptyPolicySatisfaction(now = new Date().toISOString()): PolicySatisfaction {
  return {
    satisfied: false,
    evaluatedAt: now,
    explanation: "Policy conditions have not yet been evaluated.",
  };
}

export function createEmptyContributionSummary(now = new Date().toISOString()): ContributionSummary {
  return {
    totalActiveDeclarations: 0,
    declarationsByType: createEmptyContributionsByType(),
    readinessHeadline: "No declarations recorded.",
    thresholdProgressSummary: "Required thresholds not yet evaluated.",
    derivedAt: now,
  };
}

function buildAvailabilitySummary(activeItems: ContributionItem[]): string {
  if (activeItems.length === 0) {
    return "No active declarations recorded.";
  }

  const described = activeItems
    .filter((item) => item.availability.description || item.availability.startsAt)
    .length;

  return `${activeItems.length} active declaration(s); ${described} include availability detail.`;
}

function buildSkillCoverageSummary(
  commitment: ImplementationCommitment,
  activeItems: ContributionItem[],
): string {
  if (activeItems.length === 0) {
    return "No skill coverage recorded.";
  }

  const labels = new Set<string>();

  for (const item of activeItems) {
    const profile = commitment.contributionProfiles[item.participantId];

    if (profile?.skillSummary) {
      labels.add(profile.skillSummary);
    }

    if (item.contributionCapacity.trim()) {
      labels.add(item.contributionCapacity.trim());
    }
  }

  return labels.size > 0
    ? `Coverage includes: ${Array.from(labels).join(", ")}.`
    : "Active declarations recorded without skill labels.";
}

function itemMatchesSkillLabel(item: ContributionItem, profile: ContributionProfile | undefined, label: string): boolean {
  const normalized = label.toLowerCase();

  if (item.contributionCapacity.toLowerCase().includes(normalized)) {
    return true;
  }

  if (profile?.skillSummary?.toLowerCase().includes(normalized)) {
    return true;
  }

  return false;
}

function countMatchingItems(
  commitment: ImplementationCommitment,
  activeItems: ContributionItem[],
  threshold: ReadinessThresholdFixture,
): number {
  return activeItems.filter((item) => {
    if (threshold.contributionType && item.contributionType !== threshold.contributionType) {
      return false;
    }

    if (
      threshold.requiredSkillLabel &&
      !itemMatchesSkillLabel(
        item,
        commitment.contributionProfiles[item.participantId],
        threshold.requiredSkillLabel,
      )
    ) {
      return false;
    }

    return true;
  }).length;
}

function evaluateThreshold(
  commitment: ImplementationCommitment,
  activeItems: ContributionItem[],
  threshold: ReadinessThresholdFixture,
): boolean {
  if (threshold.minimumCount !== undefined) {
    return countMatchingItems(commitment, activeItems, threshold) >= threshold.minimumCount;
  }

  if (threshold.minimumCapacity !== undefined) {
    const totalCapacity = activeItems
      .filter((item) =>
        threshold.contributionType ? item.contributionType === threshold.contributionType : true,
      )
      .reduce((sum, item) => {
        const parsed = Number.parseFloat(item.contributionCapacity);

        return Number.isFinite(parsed) ? sum + parsed : sum;
      }, 0);

    return totalCapacity >= threshold.minimumCapacity;
  }

  return countMatchingItems(commitment, activeItems, threshold) > 0;
}

export function calculateCommunityCapacity(
  commitment: ImplementationCommitment,
  now = new Date().toISOString(),
): CommunityCapacity {
  const activeItems = getActiveContributionItems(commitment);
  const contributionsByType = createEmptyContributionsByType();

  for (const item of activeItems) {
    contributionsByType[item.contributionType] += 1;
  }

  return {
    totalContributions: activeItems.length,
    contributionsByType,
    aggregateAvailabilitySummary: buildAvailabilitySummary(activeItems),
    skillCoverageSummary: buildSkillCoverageSummary(commitment, activeItems),
    derivedAt: now,
  };
}

export function calculateImplementationReadiness(
  commitment: ImplementationCommitment,
  policy: FrozenPolicyFixture,
  now = new Date().toISOString(),
): ImplementationReadiness {
  const activeItems = getActiveContributionItems(commitment);
  const requiredThresholds = policy.thresholds.filter((threshold) => !threshold.optional);
  const satisfiedThresholds: string[] = [];
  const unsatisfiedThresholds: string[] = [];

  for (const threshold of policy.thresholds) {
    if (evaluateThreshold(commitment, activeItems, threshold)) {
      satisfiedThresholds.push(threshold.thresholdId);
    } else {
      unsatisfiedThresholds.push(threshold.thresholdId);
    }
  }

  const requiredSatisfied = requiredThresholds.every((threshold) =>
    satisfiedThresholds.includes(threshold.thresholdId),
  );
  const collectionAuthoritative = ["Active", "Completed", "Withdrawn", "Archived"].includes(
    commitment.status,
  );
  const readinessReached = collectionAuthoritative && requiredSatisfied;

  const explanation = readinessReached
    ? "Declared community capacity satisfies required Frozen Policy thresholds."
    : requiredSatisfied && !collectionAuthoritative
      ? "Required thresholds are satisfied; activation is required before readiness is authoritative."
      : "Declared community capacity has not yet satisfied all required Frozen Policy thresholds.";

  return {
    readinessReached,
    satisfiedThresholds,
    unsatisfiedThresholds,
    derivedAt: now,
    explanation,
  };
}

export function calculatePolicySatisfaction(
  readiness: ImplementationReadiness,
  policy: FrozenPolicyFixture,
  now = new Date().toISOString(),
): PolicySatisfaction {
  const requiredThresholds = policy.thresholds.filter((threshold) => !threshold.optional);
  const satisfied = requiredThresholds.every((threshold) =>
    readiness.satisfiedThresholds.includes(threshold.thresholdId),
  );

  return {
    satisfied,
    evaluatedAt: now,
    explanation: satisfied
      ? "Applicable Frozen Policy conditions for readiness are satisfied."
      : "Applicable Frozen Policy conditions for readiness are not yet satisfied.",
  };
}

export function calculateContributionSummary(
  commitment: ImplementationCommitment,
  readiness: ImplementationReadiness,
  policy: FrozenPolicyFixture,
  now = new Date().toISOString(),
): ContributionSummary {
  const activeItems = getActiveContributionItems(commitment);
  const declarationsByType = createEmptyContributionsByType();

  for (const item of activeItems) {
    declarationsByType[item.contributionType] += 1;
  }

  const requiredThresholds = policy.thresholds.filter((threshold) => !threshold.optional);
  const satisfiedRequiredCount = requiredThresholds.filter((threshold) =>
    readiness.satisfiedThresholds.includes(threshold.thresholdId),
  ).length;

  return {
    totalActiveDeclarations: activeItems.length,
    declarationsByType,
    readinessHeadline: readiness.explanation,
    thresholdProgressSummary: `${satisfiedRequiredCount} of ${requiredThresholds.length} required thresholds satisfied.`,
    derivedAt: now,
  };
}

export function refreshDerivedState(commitment: ImplementationCommitment): void {
  const policy = getFrozenPolicy(commitment.frozenPolicyId) ?? bootstrapFrozenPolicy;
  const now = new Date().toISOString();

  commitment.communityCapacity = calculateCommunityCapacity(commitment, now);
  commitment.implementationReadiness = calculateImplementationReadiness(commitment, policy, now);
  commitment.policySatisfaction = calculatePolicySatisfaction(
    commitment.implementationReadiness,
    policy,
    now,
  );
  commitment.contributionSummary = calculateContributionSummary(
    commitment,
    commitment.implementationReadiness,
    policy,
    now,
  );
}

export function ensureContributionProfile(
  commitment: ImplementationCommitment,
  participantId: ParticipantId,
): ContributionProfile {
  const existing = commitment.contributionProfiles[participantId];

  if (existing) {
    return existing;
  }

  const profile: ContributionProfile = {
    participantId,
    contributionItemIds: [],
  };

  commitment.contributionProfiles[participantId] = profile;

  return profile;
}

export function assertContributionItemsPreserved(
  existing: ContributionItem[],
  proposed: ContributionItem[],
): void {
  if (proposed.length < existing.length) {
    const removed = existing.find(
      (item) => !proposed.some((candidate) => candidate.contributionItemId === item.contributionItemId),
    );

    if (removed && removed.commitmentStatus !== "Declared") {
      throw new Error(
        `Contribution Item "${removed.contributionItemId}" history must be preserved; use withdrawal instead of deletion.`,
      );
    }
  }

  for (const existingItem of existing) {
    const proposedItem = proposed.find(
      (candidate) => candidate.contributionItemId === existingItem.contributionItemId,
    );

    if (!proposedItem) {
      if (existingItem.commitmentStatus !== "Declared") {
        throw new Error(
          `Contribution Item "${existingItem.contributionItemId}" history must be preserved; use withdrawal instead of deletion.`,
        );
      }

      continue;
    }

    if (
      existingItem.declaredAt !== proposedItem.declaredAt ||
      existingItem.participantId !== proposedItem.participantId ||
      existingItem.contributionType !== proposedItem.contributionType ||
      existingItem.contributionCapacity !== proposedItem.contributionCapacity
    ) {
      throw new Error(
        `Contribution Item "${existingItem.contributionItemId}" declaration fields are immutable.`,
      );
    }
  }
}

export function validateAvailability(availability: Availability): void {
  if (!availability.description?.trim() && !availability.startsAt && !availability.endsAt) {
    throw new Error("Availability must include a description or time boundary.");
  }
}
