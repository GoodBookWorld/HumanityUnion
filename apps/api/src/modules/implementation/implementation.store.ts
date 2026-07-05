import type {
  EvidenceAttachment,
  EvidenceKind,
  EvidenceLink,
  EvidenceReference,
  Implementation,
  ImplementationPhase,
  MilestoneRequirementType,
  ParticipantId,
} from "@hu/types";

import { getDecision } from "../collective-decision/collective-decision.store.js";
import { getImplementationCommitment } from "../implementation-commitment/implementation-commitment.store.js";
import { getFrozenPolicy } from "../implementation-commitment/frozen-policy.fixture.js";
import { getMemberById } from "../member/member.store.js";
import { getPetition } from "../petition/petition.store.js";
import { bootstrapImplementation } from "./bootstrap-implementation.js";
import {
  assertMutableImplementation,
  assertPreparatoryImplementation,
  assertRecordingAllowed,
  assertStructureEditAllowed,
  assertValidTransition,
  buildEvidenceRecord,
  cloneImplementation,
  refreshDerivedState,
} from "./implementation.helpers.js";

export interface ImplementationCreateInput {
  implementationId: string;
  initiativeId: string;
  collectiveDecisionId: string;
  petitionId: string;
  implementationCommitmentId: string;
  subjectTitle: string;
  subjectSummary: string;
  frozenPolicyId?: string;
}

export interface ImplementationUpdate {
  subjectTitle?: string;
  subjectSummary?: string;
  frozenPolicyId?: string;
}

export interface AddPhaseInput {
  implementationPhaseId: string;
  title: string;
  summary: string;
  sequenceOrder: number;
}

export interface UpdatePhaseInput {
  title?: string;
  summary?: string;
  sequenceOrder?: number;
}

export interface AddMilestoneInput {
  milestoneId: string;
  implementationPhaseId: string;
  title: string;
  description: string;
  requirementType: MilestoneRequirementType;
  sequenceOrder: number;
}

export interface UpdateMilestoneInput {
  title?: string;
  description?: string;
  requirementType?: MilestoneRequirementType;
  sequenceOrder?: number;
}

export interface RecordAchievementInput {
  achievementId: string;
  milestoneId: string;
  title: string;
  summary: string;
  recordedByParticipantId: ParticipantId;
}

export interface AttachEvidenceInput {
  evidenceId: string;
  achievementId: string;
  evidenceKind: EvidenceKind;
  label: string;
  reference?: EvidenceReference | null;
  attachment?: EvidenceAttachment | null;
  link?: EvidenceLink | null;
}

const implementations = new Map<string, Implementation>([
  [bootstrapImplementation.implementationId, structuredClone(bootstrapImplementation)],
]);

refreshDerivedState(implementations.get(bootstrapImplementation.implementationId)!);

function getMutableImplementation(implementationId: string): Implementation | null {
  return implementations.get(implementationId) ?? null;
}

function touchImplementation(implementation: Implementation) {
  implementation.updatedAt = new Date().toISOString();
  refreshDerivedState(implementation);
  return cloneImplementation(implementation);
}

function assertApprovedCollectiveDecision(collectiveDecisionId: string): void {
  const decision = getDecision(collectiveDecisionId);

  if (!decision) {
    throw new Error(`Collective Decision "${collectiveDecisionId}" was not found.`);
  }

  if (decision.outcome?.outcomeType !== "Approved") {
    throw new Error("Implementation may only be created from an approved Collective Decision.");
  }
}

function assertPetitionEligibility(petitionId: string, initiativeId: string): void {
  const petition = getPetition(petitionId);

  if (!petition) {
    throw new Error(`Petition "${petitionId}" was not found.`);
  }

  if (petition.subject.initiativeId !== initiativeId) {
    throw new Error(
      "Petition subject Initiative reference does not match Implementation Initiative.",
    );
  }
}

function assertValidFrozenPolicyReference(frozenPolicyId: string): void {
  if (!getFrozenPolicy(frozenPolicyId)) {
    throw new Error(`Frozen Policy "${frozenPolicyId}" was not found.`);
  }
}

function assertCommitmentContext(
  implementationCommitmentId: string,
  initiativeId: string,
  collectiveDecisionId: string,
  petitionId: string,
): void {
  const commitment = getImplementationCommitment(implementationCommitmentId);

  if (!commitment) {
    throw new Error(`Implementation Commitment "${implementationCommitmentId}" was not found.`);
  }

  if (commitment.initiativeId !== initiativeId) {
    throw new Error(
      "Implementation Initiative reference does not match Implementation Commitment.",
    );
  }

  if (commitment.collectiveDecisionId !== collectiveDecisionId) {
    throw new Error(
      "Implementation Collective Decision reference does not match Implementation Commitment.",
    );
  }

  if (commitment.petitionId !== petitionId) {
    throw new Error("Implementation Petition reference does not match Implementation Commitment.");
  }
}

function assertUniqueImplementationPath(
  implementationCommitmentId: string,
  implementationId?: string,
): void {
  const duplicate = Array.from(implementations.values()).find(
    (entry) =>
      entry.implementationCommitmentId === implementationCommitmentId &&
      entry.implementationId !== implementationId,
  );

  if (duplicate) {
    throw new Error(
      `Implementation already exists for Implementation Commitment "${implementationCommitmentId}".`,
    );
  }
}

function assertSubjectSnapshotComplete(subjectTitle: string, subjectSummary: string): void {
  if (!subjectTitle.trim() || !subjectSummary.trim()) {
    throw new Error("Subject snapshot must be complete before lifecycle progression.");
  }
}

function assertRegisteredParticipant(participantId: ParticipantId): void {
  if (!getMemberById(participantId)) {
    throw new Error(`Participant "${participantId}" was not found.`);
  }
}

function ensureInProgressForRecording(implementation: Implementation): void {
  assertRecordingAllowed(implementation.status);

  if (implementation.status === "Started") {
    assertValidTransition(implementation.status, "InProgress");
    implementation.status = "InProgress";
  }
}

function getPhase(
  implementation: Implementation,
  implementationPhaseId: string,
): ImplementationPhase {
  const phase = implementation.implementationPhases.find(
    (entry) => entry.implementationPhaseId === implementationPhaseId,
  );

  if (!phase) {
    throw new Error(`Implementation Phase "${implementationPhaseId}" was not found.`);
  }

  return phase;
}

function getMilestone(implementation: Implementation, milestoneId: string) {
  const milestone = implementation.milestones.find((entry) => entry.milestoneId === milestoneId);

  if (!milestone) {
    throw new Error(`Milestone "${milestoneId}" was not found.`);
  }

  return milestone;
}

export function listImplementations() {
  return Array.from(implementations.values(), (implementation) =>
    cloneImplementation(implementation),
  );
}

export function getImplementation(implementationId: string) {
  const implementation = implementations.get(implementationId);

  return implementation ? cloneImplementation(implementation) : null;
}

export function getImplementationByCommitmentId(implementationCommitmentId: string) {
  const implementation = Array.from(implementations.values()).find(
    (entry) => entry.implementationCommitmentId === implementationCommitmentId,
  );

  return implementation ? cloneImplementation(implementation) : null;
}

export function getImplementationByInitiativeId(initiativeId: string) {
  const implementation = Array.from(implementations.values()).find(
    (entry) => entry.initiativeId === initiativeId,
  );

  return implementation ? cloneImplementation(implementation) : null;
}

export function getImplementationByCollectiveDecisionId(collectiveDecisionId: string) {
  const implementation = Array.from(implementations.values()).find(
    (entry) => entry.collectiveDecisionId === collectiveDecisionId,
  );

  return implementation ? cloneImplementation(implementation) : null;
}

export function getImplementationByPetitionId(petitionId: string) {
  const implementation = Array.from(implementations.values()).find(
    (entry) => entry.petitionId === petitionId,
  );

  return implementation ? cloneImplementation(implementation) : null;
}

export function createImplementation(input: ImplementationCreateInput) {
  if (implementations.has(input.implementationId)) {
    throw new Error(`Implementation "${input.implementationId}" already exists.`);
  }

  assertApprovedCollectiveDecision(input.collectiveDecisionId);
  assertPetitionEligibility(input.petitionId, input.initiativeId);
  assertCommitmentContext(
    input.implementationCommitmentId,
    input.initiativeId,
    input.collectiveDecisionId,
    input.petitionId,
  );
  assertUniqueImplementationPath(input.implementationCommitmentId);

  const frozenPolicyId = input.frozenPolicyId ?? "";

  if (frozenPolicyId) {
    assertValidFrozenPolicyReference(frozenPolicyId);
  }

  const now = new Date().toISOString();
  const created = {
    implementationId: input.implementationId,
    initiativeId: input.initiativeId,
    collectiveDecisionId: input.collectiveDecisionId,
    petitionId: input.petitionId,
    implementationCommitmentId: input.implementationCommitmentId,
    frozenPolicyId,
    status: "Planned" as const,
    subjectTitle: input.subjectTitle,
    subjectSummary: input.subjectSummary,
    createdAt: now,
    updatedAt: now,
    implementationPhases: [],
    milestones: [],
    achievements: [],
    evidence: [],
    collectiveProgress: {
      totalAchievements: 0,
      completedPhaseCount: 0,
      completedMilestoneCount: 0,
      requiredMilestonesSatisfiedCount: 0,
      requiredMilestonesTotalCount: 0,
      optionalMilestonesSatisfiedCount: 0,
      aggregateProgressSummary: "No collective achievements recorded yet.",
      derivedAt: now,
    },
    completionAssessment: {
      assessmentReached: false,
      satisfiedCriteria: [],
      unsatisfiedCriteria: [],
      evaluatedAt: now,
      explanation: "Completion assessment will be derived when milestones and achievements exist.",
    },
    completion: {
      completionReached: false,
      derivedAt: now,
      explanation: "Implementation completion has not been derived yet.",
    },
    progressIndicator: {
      headline: "Collective progress has not been recorded yet.",
      requiredMilestoneProgressLabel: "Required milestones not yet evaluated.",
      derivedAt: now,
    },
    completionIndicator: {
      completionReached: false,
      headline: "Implementation is not yet complete.",
      requiredCriteriaProgressLabel: "Required completion criteria not yet evaluated.",
      derivedAt: now,
    },
    progressSnapshots: [],
  };

  refreshDerivedState(created);
  implementations.set(created.implementationId, created);

  return cloneImplementation(created);
}

export function startImplementation(implementationId: string) {
  const implementation = getMutableImplementation(implementationId);

  if (!implementation) {
    return null;
  }

  assertMutableImplementation(implementation.status);
  assertValidTransition(implementation.status, "Started");
  assertSubjectSnapshotComplete(implementation.subjectTitle, implementation.subjectSummary);

  if (!implementation.frozenPolicyId) {
    throw new Error("Frozen Policy must be attached before Implementation may start.");
  }

  assertValidFrozenPolicyReference(implementation.frozenPolicyId);
  assertCommitmentContext(
    implementation.implementationCommitmentId,
    implementation.initiativeId,
    implementation.collectiveDecisionId,
    implementation.petitionId,
  );

  implementation.status = "Started";

  return touchImplementation(implementation);
}

export function updateImplementation(implementationId: string, update: ImplementationUpdate) {
  const implementation = getMutableImplementation(implementationId);

  if (!implementation) {
    return null;
  }

  assertMutableImplementation(implementation.status);
  assertPreparatoryImplementation(implementation.status);

  if (update.subjectTitle !== undefined) {
    implementation.subjectTitle = update.subjectTitle;
  }

  if (update.subjectSummary !== undefined) {
    implementation.subjectSummary = update.subjectSummary;
  }

  if (update.frozenPolicyId !== undefined) {
    assertValidFrozenPolicyReference(update.frozenPolicyId);
    implementation.frozenPolicyId = update.frozenPolicyId;
  }

  return touchImplementation(implementation);
}

export function addPhase(implementationId: string, input: AddPhaseInput) {
  const implementation = getMutableImplementation(implementationId);

  if (!implementation) {
    return null;
  }

  assertMutableImplementation(implementation.status);
  assertStructureEditAllowed(implementation.status);

  if (
    implementation.implementationPhases.some(
      (phase) => phase.implementationPhaseId === input.implementationPhaseId,
    )
  ) {
    throw new Error(`Implementation Phase "${input.implementationPhaseId}" already exists.`);
  }

  const now = new Date().toISOString();

  implementation.implementationPhases.push({
    implementationPhaseId: input.implementationPhaseId,
    implementationId: implementation.implementationId,
    title: input.title,
    summary: input.summary,
    sequenceOrder: input.sequenceOrder,
    status: "Open",
    createdAt: now,
    updatedAt: now,
  });

  return touchImplementation(implementation);
}

export function updatePhase(
  implementationId: string,
  implementationPhaseId: string,
  update: UpdatePhaseInput,
) {
  const implementation = getMutableImplementation(implementationId);

  if (!implementation) {
    return null;
  }

  assertMutableImplementation(implementation.status);
  assertStructureEditAllowed(implementation.status);

  const phase = getPhase(implementation, implementationPhaseId);

  if (update.title !== undefined) {
    phase.title = update.title;
  }

  if (update.summary !== undefined) {
    phase.summary = update.summary;
  }

  if (update.sequenceOrder !== undefined) {
    phase.sequenceOrder = update.sequenceOrder;
  }

  phase.updatedAt = new Date().toISOString();

  return touchImplementation(implementation);
}

export function addMilestone(implementationId: string, input: AddMilestoneInput) {
  const implementation = getMutableImplementation(implementationId);

  if (!implementation) {
    return null;
  }

  assertMutableImplementation(implementation.status);
  assertStructureEditAllowed(implementation.status);
  getPhase(implementation, input.implementationPhaseId);

  if (implementation.milestones.some((milestone) => milestone.milestoneId === input.milestoneId)) {
    throw new Error(`Milestone "${input.milestoneId}" already exists.`);
  }

  const now = new Date().toISOString();

  implementation.milestones.push({
    milestoneId: input.milestoneId,
    implementationId: implementation.implementationId,
    implementationPhaseId: input.implementationPhaseId,
    title: input.title,
    description: input.description,
    requirementType: input.requirementType,
    status: "Open",
    sequenceOrder: input.sequenceOrder,
    createdAt: now,
    updatedAt: now,
    satisfiedAt: null,
  });

  return touchImplementation(implementation);
}

export function updateMilestone(
  implementationId: string,
  milestoneId: string,
  update: UpdateMilestoneInput,
) {
  const implementation = getMutableImplementation(implementationId);

  if (!implementation) {
    return null;
  }

  assertMutableImplementation(implementation.status);
  assertStructureEditAllowed(implementation.status);

  const milestone = getMilestone(implementation, milestoneId);

  if (update.title !== undefined) {
    milestone.title = update.title;
  }

  if (update.description !== undefined) {
    milestone.description = update.description;
  }

  if (update.requirementType !== undefined) {
    milestone.requirementType = update.requirementType;
  }

  if (update.sequenceOrder !== undefined) {
    milestone.sequenceOrder = update.sequenceOrder;
  }

  milestone.updatedAt = new Date().toISOString();

  return touchImplementation(implementation);
}

export function recordAchievement(implementationId: string, input: RecordAchievementInput) {
  const implementation = getMutableImplementation(implementationId);

  if (!implementation) {
    return null;
  }

  assertMutableImplementation(implementation.status);
  ensureInProgressForRecording(implementation);

  if (
    implementation.achievements.some(
      (achievement) => achievement.achievementId === input.achievementId,
    )
  ) {
    throw new Error(`Achievement "${input.achievementId}" already exists.`);
  }

  assertRegisteredParticipant(input.recordedByParticipantId);

  const milestone = getMilestone(implementation, input.milestoneId);

  if (milestone.status === "Satisfied") {
    throw new Error(
      "Achievements may not be recorded against a milestone that is already satisfied.",
    );
  }

  const now = new Date().toISOString();

  implementation.achievements.push({
    achievementId: input.achievementId,
    implementationId: implementation.implementationId,
    milestoneId: input.milestoneId,
    title: input.title,
    summary: input.summary,
    recordedAt: now,
    recordedByParticipantId: input.recordedByParticipantId,
    createdAt: now,
    updatedAt: now,
  });

  return touchImplementation(implementation);
}

export function attachEvidence(implementationId: string, input: AttachEvidenceInput) {
  const implementation = getMutableImplementation(implementationId);

  if (!implementation) {
    return null;
  }

  assertMutableImplementation(implementation.status);
  ensureInProgressForRecording(implementation);

  if (implementation.evidence.some((entry) => entry.evidenceId === input.evidenceId)) {
    throw new Error(`Evidence "${input.evidenceId}" already exists.`);
  }

  const achievement = implementation.achievements.find(
    (entry) => entry.achievementId === input.achievementId,
  );

  if (!achievement) {
    throw new Error(`Achievement "${input.achievementId}" was not found.`);
  }

  const now = new Date().toISOString();
  const evidence = buildEvidenceRecord(
    input.evidenceId,
    input.achievementId,
    implementation.implementationId,
    input.evidenceKind,
    input.label,
    input.reference,
    input.attachment,
    input.link,
    now,
  );

  implementation.evidence.push(evidence);

  return touchImplementation(implementation);
}

export function archiveImplementation(implementationId: string) {
  const implementation = getMutableImplementation(implementationId);

  if (!implementation) {
    return null;
  }

  assertValidTransition(implementation.status, "Archived");

  if (implementation.status !== "Completed") {
    throw new Error("Implementation may only be archived from Completed status.");
  }

  implementation.status = "Archived";

  return touchImplementation(implementation);
}
