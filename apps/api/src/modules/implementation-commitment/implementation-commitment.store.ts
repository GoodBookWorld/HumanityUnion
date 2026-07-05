import type {
  Availability,
  CommitmentContributionType,
  ContributionItem,
  ImplementationCommitment,
  ParticipantId,
} from "@hu/types";

import { getDecision } from "../collective-decision/collective-decision.store.js";
import { getMemberById } from "../member/member.store.js";
import { getPetition } from "../petition/petition.store.js";
import { bootstrapImplementationCommitment } from "./bootstrap-implementation-commitment.js";
import { getFrozenPolicy } from "./frozen-policy.fixture.js";
import {
  assertContributionItemsPreserved,
  assertMutableCommitment,
  assertPreparatoryCommitment,
  assertProfileUpdateAllowed,
  assertValidTransition,
  cloneImplementationCommitment,
  ensureContributionProfile,
  hasActiveContributionForParticipant,
  refreshDerivedState,
  validateAvailability,
} from "./implementation-commitment.helpers.js";

export interface ImplementationCommitmentCreateInput {
  implementationCommitmentId: string;
  initiativeId: string;
  collectiveDecisionId: string;
  petitionId: string;
  subjectTitle: string;
  subjectSummary: string;
  frozenPolicyId?: string;
}

export interface ImplementationCommitmentUpdate {
  subjectTitle?: string;
  subjectSummary?: string;
  frozenPolicyId?: string;
}

export interface ContributionProfileUpdate {
  skillSummary?: string;
  regionalContext?: string;
  organizationalContext?: string;
}

export interface AddContributionItemInput {
  contributionItemId: string;
  participantId: ParticipantId;
  contributionType: CommitmentContributionType;
  contributionCapacity: string;
  availability: Availability;
  profile?: ContributionProfileUpdate;
}

const commitments = new Map<string, ImplementationCommitment>([
  [
    bootstrapImplementationCommitment.implementationCommitmentId,
    structuredClone(bootstrapImplementationCommitment),
  ],
]);

refreshDerivedState(commitments.get(bootstrapImplementationCommitment.implementationCommitmentId)!);

function getMutableCommitment(implementationCommitmentId: string): ImplementationCommitment | null {
  return commitments.get(implementationCommitmentId) ?? null;
}

function touchCommitment(commitment: ImplementationCommitment): ImplementationCommitment {
  commitment.updatedAt = new Date().toISOString();
  refreshDerivedState(commitment);
  return cloneImplementationCommitment(commitment);
}

function assertRegisteredParticipant(participantId: ParticipantId): void {
  if (!getMemberById(participantId)) {
    throw new Error(`Participant "${participantId}" was not found.`);
  }
}

function assertApprovedCollectiveDecision(collectiveDecisionId: string): void {
  const decision = getDecision(collectiveDecisionId);

  if (!decision) {
    throw new Error(`Collective Decision "${collectiveDecisionId}" was not found.`);
  }

  if (decision.outcome?.outcomeType !== "Approved") {
    throw new Error(
      "Implementation Commitment may only be created from an approved Collective Decision.",
    );
  }
}

function assertPetitionEligibility(petitionId: string, initiativeId: string): void {
  const petition = getPetition(petitionId);

  if (!petition) {
    throw new Error(`Petition "${petitionId}" was not found.`);
  }

  if (petition.subject.initiativeId !== initiativeId) {
    throw new Error("Petition subject Initiative reference does not match commitment Initiative.");
  }

  if (petition.status !== "Closed" && petition.status !== "Open") {
    throw new Error(
      "Petition must be Open or Closed before Implementation Commitment collection may begin.",
    );
  }
}

function assertUniqueCommitmentPath(
  collectiveDecisionId: string,
  implementationCommitmentId?: string,
): void {
  const duplicate = Array.from(commitments.values()).find(
    (entry) =>
      entry.collectiveDecisionId === collectiveDecisionId &&
      entry.implementationCommitmentId !== implementationCommitmentId,
  );

  if (duplicate) {
    throw new Error(
      `Implementation Commitment already exists for Collective Decision "${collectiveDecisionId}".`,
    );
  }
}

function assertValidFrozenPolicyReference(frozenPolicyId: string): void {
  if (!getFrozenPolicy(frozenPolicyId)) {
    throw new Error(`Frozen Policy "${frozenPolicyId}" was not found.`);
  }
}

function assertSubjectSnapshotComplete(commitment: ImplementationCommitment): void {
  if (!commitment.subjectTitle.trim() || !commitment.subjectSummary.trim()) {
    throw new Error("Subject snapshot must be complete before submission.");
  }
}

function assertRemovalAllowed(commitment: ImplementationCommitment): void {
  if (commitment.status === "Draft" || commitment.status === "Submitted") {
    return;
  }

  if (commitment.status === "Active") {
    const policy = getFrozenPolicy(commitment.frozenPolicyId);

    if (policy?.allowRemovalInActive) {
      return;
    }
  }

  throw new Error(
    "Contribution Items may only be removed in preparatory states unless Frozen Policy permits Active removal.",
  );
}

export function listImplementationCommitments(): ImplementationCommitment[] {
  return Array.from(commitments.values(), (commitment) =>
    cloneImplementationCommitment(commitment),
  );
}

export function getImplementationCommitment(
  implementationCommitmentId: string,
): ImplementationCommitment | null {
  const commitment = commitments.get(implementationCommitmentId);

  return commitment ? cloneImplementationCommitment(commitment) : null;
}

export function getImplementationCommitmentByCollectiveDecisionId(
  collectiveDecisionId: string,
): ImplementationCommitment | null {
  const commitment = Array.from(commitments.values()).find(
    (entry) => entry.collectiveDecisionId === collectiveDecisionId,
  );

  return commitment ? cloneImplementationCommitment(commitment) : null;
}

export function getImplementationCommitmentByInitiativeId(
  initiativeId: string,
): ImplementationCommitment | null {
  const commitment = Array.from(commitments.values()).find(
    (entry) => entry.initiativeId === initiativeId,
  );

  return commitment ? cloneImplementationCommitment(commitment) : null;
}

export function getImplementationCommitmentByPetitionId(
  petitionId: string,
): ImplementationCommitment | null {
  const commitment = Array.from(commitments.values()).find(
    (entry) => entry.petitionId === petitionId,
  );

  return commitment ? cloneImplementationCommitment(commitment) : null;
}

export function participantHasActiveContribution(
  implementationCommitmentId: string,
  participantId: ParticipantId,
): boolean {
  const commitment = commitments.get(implementationCommitmentId);

  if (!commitment) {
    return false;
  }

  return hasActiveContributionForParticipant(commitment, participantId);
}

export function createImplementationCommitment(
  input: ImplementationCommitmentCreateInput,
): ImplementationCommitment {
  if (commitments.has(input.implementationCommitmentId)) {
    throw new Error(
      `Implementation Commitment "${input.implementationCommitmentId}" already exists.`,
    );
  }

  assertApprovedCollectiveDecision(input.collectiveDecisionId);
  assertPetitionEligibility(input.petitionId, input.initiativeId);
  assertUniqueCommitmentPath(input.collectiveDecisionId);

  if (input.frozenPolicyId) {
    assertValidFrozenPolicyReference(input.frozenPolicyId);
  }

  const now = new Date().toISOString();
  const created: ImplementationCommitment = {
    implementationCommitmentId: input.implementationCommitmentId,
    initiativeId: input.initiativeId,
    collectiveDecisionId: input.collectiveDecisionId,
    petitionId: input.petitionId,
    status: "Draft",
    subjectTitle: input.subjectTitle,
    subjectSummary: input.subjectSummary,
    frozenPolicyId: input.frozenPolicyId ?? "",
    createdAt: now,
    updatedAt: now,
    contributionProfiles: {},
    contributionItems: [],
    communityCapacity: {
      totalContributions: 0,
      contributionsByType: { Volunteer: 0, Professional: 0, Resource: 0 },
      aggregateAvailabilitySummary: "No active declarations recorded.",
      skillCoverageSummary: "No skill coverage recorded.",
      derivedAt: now,
    },
    implementationReadiness: {
      readinessReached: false,
      satisfiedThresholds: [],
      unsatisfiedThresholds: [],
      derivedAt: now,
      explanation: "Implementation Readiness will be derived when collection is active.",
    },
    policySatisfaction: {
      satisfied: false,
      evaluatedAt: now,
      explanation: "Policy conditions have not yet been evaluated.",
    },
    contributionSummary: {
      totalActiveDeclarations: 0,
      declarationsByType: { Volunteer: 0, Professional: 0, Resource: 0 },
      readinessHeadline: "No declarations recorded.",
      thresholdProgressSummary: "Required thresholds not yet evaluated.",
      derivedAt: now,
    },
  };

  refreshDerivedState(created);
  commitments.set(created.implementationCommitmentId, created);

  return cloneImplementationCommitment(created);
}

export function updateImplementationCommitment(
  implementationCommitmentId: string,
  update: ImplementationCommitmentUpdate,
): ImplementationCommitment | null {
  const commitment = getMutableCommitment(implementationCommitmentId);

  if (!commitment) {
    return null;
  }

  assertMutableCommitment(commitment.status);
  assertPreparatoryCommitment(commitment.status);

  if (update.subjectTitle !== undefined) {
    commitment.subjectTitle = update.subjectTitle;
  }

  if (update.subjectSummary !== undefined) {
    commitment.subjectSummary = update.subjectSummary;
  }

  if (update.frozenPolicyId !== undefined) {
    assertValidFrozenPolicyReference(update.frozenPolicyId);
    commitment.frozenPolicyId = update.frozenPolicyId;
  }

  return touchCommitment(commitment);
}

export function submitImplementationCommitment(
  implementationCommitmentId: string,
): ImplementationCommitment | null {
  const commitment = getMutableCommitment(implementationCommitmentId);

  if (!commitment) {
    return null;
  }

  assertMutableCommitment(commitment.status);
  assertValidTransition(commitment.status, "Submitted");
  assertSubjectSnapshotComplete(commitment);

  if (!commitment.frozenPolicyId) {
    throw new Error("Frozen Policy must be attached before submission.");
  }

  assertValidFrozenPolicyReference(commitment.frozenPolicyId);

  commitment.status = "Submitted";

  return touchCommitment(commitment);
}

export function activateImplementationCommitment(
  implementationCommitmentId: string,
): ImplementationCommitment | null {
  const commitment = getMutableCommitment(implementationCommitmentId);

  if (!commitment) {
    return null;
  }

  assertMutableCommitment(commitment.status);
  assertValidTransition(commitment.status, "Active");
  assertValidFrozenPolicyReference(commitment.frozenPolicyId);

  commitment.status = "Active";

  return touchCommitment(commitment);
}

export function updateContributionProfile(
  implementationCommitmentId: string,
  participantId: ParticipantId,
  update: ContributionProfileUpdate,
): ImplementationCommitment | null {
  const commitment = getMutableCommitment(implementationCommitmentId);

  if (!commitment) {
    return null;
  }

  assertMutableCommitment(commitment.status);
  assertProfileUpdateAllowed(commitment.status);
  assertRegisteredParticipant(participantId);

  const profile = ensureContributionProfile(commitment, participantId);

  if (update.skillSummary !== undefined) {
    profile.skillSummary = update.skillSummary;
  }

  if (update.regionalContext !== undefined) {
    profile.regionalContext = update.regionalContext;
  }

  if (update.organizationalContext !== undefined) {
    profile.organizationalContext = update.organizationalContext;
  }

  return touchCommitment(commitment);
}

export function addContributionItem(
  implementationCommitmentId: string,
  input: AddContributionItemInput,
): ImplementationCommitment | null {
  const commitment = getMutableCommitment(implementationCommitmentId);

  if (!commitment) {
    return null;
  }

  assertMutableCommitment(commitment.status);

  if (commitment.status !== "Active") {
    throw new Error("Contribution Items may only be added while the commitment is Active.");
  }

  assertRegisteredParticipant(input.participantId);
  assertValidFrozenPolicyReference(commitment.frozenPolicyId);

  if (!input.contributionCapacity.trim()) {
    throw new Error("Contribution capacity must be provided.");
  }

  validateAvailability(input.availability);

  if (
    commitment.contributionItems.some(
      (item) => item.contributionItemId === input.contributionItemId,
    )
  ) {
    throw new Error(`Contribution Item "${input.contributionItemId}" already exists.`);
  }

  if (hasActiveContributionForParticipant(commitment, input.participantId)) {
    throw new Error(
      `Participant "${input.participantId}" already has an active commitment declaration in this context.`,
    );
  }

  const now = new Date().toISOString();
  const profile = ensureContributionProfile(commitment, input.participantId);

  if (input.profile) {
    if (input.profile.skillSummary !== undefined) {
      profile.skillSummary = input.profile.skillSummary;
    }

    if (input.profile.regionalContext !== undefined) {
      profile.regionalContext = input.profile.regionalContext;
    }

    if (input.profile.organizationalContext !== undefined) {
      profile.organizationalContext = input.profile.organizationalContext;
    }
  }

  const item: ContributionItem = {
    contributionItemId: input.contributionItemId,
    implementationCommitmentId: commitment.implementationCommitmentId,
    participantId: input.participantId,
    contributionType: input.contributionType,
    contributionCapacity: input.contributionCapacity,
    availability: structuredClone(input.availability),
    commitmentStatus: "Declared",
    declaredAt: now,
    updatedAt: now,
  };

  const nextItems = [...commitment.contributionItems, item];
  assertContributionItemsPreserved(commitment.contributionItems, nextItems);
  commitment.contributionItems = nextItems;
  profile.contributionItemIds = [...profile.contributionItemIds, item.contributionItemId];

  return touchCommitment(commitment);
}

export function removeContributionItem(
  implementationCommitmentId: string,
  contributionItemId: string,
): ImplementationCommitment | null {
  const commitment = getMutableCommitment(implementationCommitmentId);

  if (!commitment) {
    return null;
  }

  assertMutableCommitment(commitment.status);
  assertRemovalAllowed(commitment);

  const existingItem = commitment.contributionItems.find(
    (item) => item.contributionItemId === contributionItemId,
  );

  if (!existingItem) {
    throw new Error(`Contribution Item "${contributionItemId}" was not found.`);
  }

  if (existingItem.commitmentStatus !== "Declared") {
    throw new Error(
      `Contribution Item "${contributionItemId}" cannot be removed; use withdrawal to preserve history.`,
    );
  }

  commitment.contributionItems = commitment.contributionItems.filter(
    (item) => item.contributionItemId !== contributionItemId,
  );

  const profile = commitment.contributionProfiles[existingItem.participantId];

  if (profile) {
    profile.contributionItemIds = profile.contributionItemIds.filter(
      (id) => id !== contributionItemId,
    );
  }

  return touchCommitment(commitment);
}

export function withdrawCommitment(
  implementationCommitmentId: string,
  contributionItemId: string,
  participantId?: ParticipantId,
): ImplementationCommitment | null {
  const commitment = getMutableCommitment(implementationCommitmentId);

  if (!commitment) {
    return null;
  }

  assertMutableCommitment(commitment.status);

  if (commitment.status !== "Active") {
    throw new Error("Contribution withdrawal is only permitted while the commitment is Active.");
  }

  const policy = getFrozenPolicy(commitment.frozenPolicyId);

  if (!policy?.allowWithdrawal) {
    throw new Error("Frozen Policy does not permit contribution withdrawal.");
  }

  const item = commitment.contributionItems.find(
    (candidate) => candidate.contributionItemId === contributionItemId,
  );

  if (!item) {
    throw new Error(`Contribution Item "${contributionItemId}" was not found.`);
  }

  if (item.commitmentStatus !== "Declared") {
    throw new Error(`Contribution Item "${contributionItemId}" is not active.`);
  }

  if (participantId && item.participantId !== participantId) {
    throw new Error(
      `Participant "${participantId}" may not withdraw Contribution Item "${contributionItemId}".`,
    );
  }

  const now = new Date().toISOString();
  item.commitmentStatus = "Withdrawn";
  item.withdrawnAt = now;
  item.updatedAt = now;

  return touchCommitment(commitment);
}

export function withdrawCommitmentPhase(
  implementationCommitmentId: string,
): ImplementationCommitment | null {
  const commitment = getMutableCommitment(implementationCommitmentId);

  if (!commitment) {
    return null;
  }

  assertMutableCommitment(commitment.status);
  assertValidTransition(commitment.status, "Withdrawn");

  commitment.status = "Withdrawn";

  return touchCommitment(commitment);
}

export function completeImplementationCommitment(
  implementationCommitmentId: string,
): ImplementationCommitment | null {
  const commitment = getMutableCommitment(implementationCommitmentId);

  if (!commitment) {
    return null;
  }

  assertMutableCommitment(commitment.status);
  assertValidTransition(commitment.status, "Completed");

  refreshDerivedState(commitment);

  if (!commitment.implementationReadiness.readinessReached) {
    throw new Error(
      "Implementation Commitment cannot be completed until Implementation Readiness is reached.",
    );
  }

  if (!commitment.policySatisfaction.satisfied) {
    throw new Error(
      "Implementation Commitment cannot be completed until Policy Satisfaction conditions are met.",
    );
  }

  commitment.status = "Completed";

  return touchCommitment(commitment);
}

export function archiveImplementationCommitment(
  implementationCommitmentId: string,
): ImplementationCommitment | null {
  const commitment = getMutableCommitment(implementationCommitmentId);

  if (!commitment) {
    return null;
  }

  assertValidTransition(commitment.status, "Archived");
  commitment.status = "Archived";

  return touchCommitment(commitment);
}
