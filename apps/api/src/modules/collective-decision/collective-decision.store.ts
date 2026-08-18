import type {
  Ballot,
  CollectiveDecision,
  DecisionResult,
  DecisionSubjectType,
  Outcome,
  ParticipantDecision,
} from "@hu/types";

import { bootstrapCollectiveDecision } from "./bootstrap-collective-decision.js";
import {
  assertParticipantDecisionsImmutable,
  assertValidTransition,
  buildDecisionResult,
  buildOutcome,
  calculateDecisionStatistics,
  cloneCollectiveDecision,
  getSubmittedParticipantDecisions,
  isParticipantEligible,
} from "./collective-decision.helpers.js";

export interface CollectiveDecisionUpdate {
  ballot?: Partial<Ballot>;
}

const decisions = new Map<string, CollectiveDecision>([
  [bootstrapCollectiveDecision.decisionId, structuredClone(bootstrapCollectiveDecision)],
]);

void refreshDerivedState(decisions.get(bootstrapCollectiveDecision.decisionId)!).catch(() => {
  // Bootstrap statistics may be unavailable when Mongo is offline (unit tests).
});

async function refreshDerivedState(decision: CollectiveDecision): Promise<void> {
  decision.statistics = await calculateDecisionStatistics(decision);
}

function getMutableDecision(decisionId: string): CollectiveDecision | null {
  return decisions.get(decisionId) ?? null;
}

async function touchDecision(decision: CollectiveDecision): Promise<CollectiveDecision> {
  decision.updatedAt = new Date().toISOString();
  await refreshDerivedState(decision);
  return cloneCollectiveDecision(decision);
}

export function listDecisions(): CollectiveDecision[] {
  return Array.from(decisions.values(), (decision) => cloneCollectiveDecision(decision));
}

export function getDecision(decisionId: string): CollectiveDecision | null {
  const decision = decisions.get(decisionId);

  return decision ? cloneCollectiveDecision(decision) : null;
}

export function getDecisionBySubjectId(
  subjectType: DecisionSubjectType,
  subjectId: string,
): CollectiveDecision | null {
  const decision = Array.from(decisions.values()).find(
    (entry) => entry.decisionSubjectType === subjectType && entry.decisionSubjectId === subjectId,
  );

  return decision ? cloneCollectiveDecision(decision) : null;
}

export async function createDecision(decision: CollectiveDecision): Promise<CollectiveDecision> {
  if (decisions.has(decision.decisionId)) {
    throw new Error(`Decision "${decision.decisionId}" already exists.`);
  }

  const created = structuredClone(decision);
  await refreshDerivedState(created);
  decisions.set(created.decisionId, created);

  return cloneCollectiveDecision(created);
}

export async function updateDecision(
  decisionId: string,
  update: CollectiveDecisionUpdate,
): Promise<CollectiveDecision | null> {
  const decision = getMutableDecision(decisionId);

  if (!decision) {
    return null;
  }

  if (decision.status !== "Draft") {
    throw new Error("Only Draft decisions can be updated.");
  }

  if (update.ballot !== undefined) {
    Object.assign(decision.ballot, structuredClone(update.ballot));
  }

  return touchDecision(decision);
}

export async function archiveDecision(decisionId: string): Promise<CollectiveDecision | null> {
  const decision = getMutableDecision(decisionId);

  if (!decision) {
    return null;
  }

  assertValidTransition(decision.status, "Archived");
  decision.status = "Archived";
  decision.timeline.archivedAt = new Date().toISOString();

  return touchDecision(decision);
}

export async function scheduleDecision(
  decisionId: string,
  scheduledAt: string,
): Promise<CollectiveDecision | null> {
  const decision = getMutableDecision(decisionId);

  if (!decision) {
    return null;
  }

  assertValidTransition(decision.status, "Scheduled");
  decision.status = "Scheduled";
  decision.timeline.scheduledAt = scheduledAt;

  return touchDecision(decision);
}

export async function openDecision(
  decisionId: string,
  opensAt: string,
): Promise<CollectiveDecision | null> {
  const decision = getMutableDecision(decisionId);

  if (!decision) {
    return null;
  }

  assertValidTransition(decision.status, "Active");
  decision.status = "Active";
  decision.timeline.opensAt = opensAt;
  decision.ballot.opensAt = opensAt;

  return touchDecision(decision);
}

export async function closeDecision(
  decisionId: string,
  closesAt: string,
): Promise<CollectiveDecision | null> {
  const decision = getMutableDecision(decisionId);

  if (!decision) {
    return null;
  }

  assertValidTransition(decision.status, "Closed");
  decision.status = "Closed";
  decision.timeline.closesAt = closesAt;
  decision.ballot.closesAt = closesAt;

  return touchDecision(decision);
}

export async function cancelDecision(decisionId: string): Promise<CollectiveDecision | null> {
  const decision = getMutableDecision(decisionId);

  if (!decision) {
    return null;
  }

  assertValidTransition(decision.status, "Cancelled");

  if (getSubmittedParticipantDecisions(decision.participantDecisions).length > 0) {
    throw new Error("Decisions with submitted Participant Decisions cannot be cancelled.");
  }

  decision.status = "Cancelled";

  return touchDecision(decision);
}

export async function calculateDecisionResult(decisionId: string): Promise<DecisionResult | null> {
  const decision = getMutableDecision(decisionId);

  if (!decision) {
    return null;
  }

  if (decision.status !== "Closed" && decision.status !== "Completed") {
    throw new Error("DecisionResult can only be calculated after the decision is Closed.");
  }

  await refreshDerivedState(decision);
  const result = buildDecisionResult(decision);
  decision.decisionResult = structuredClone(result);

  await touchDecision(decision);

  return structuredClone(result);
}

export async function determineOutcome(decisionId: string): Promise<Outcome | null> {
  const decision = getMutableDecision(decisionId);

  if (!decision) {
    return null;
  }

  if (!decision.decisionResult) {
    throw new Error("Outcome requires a calculated DecisionResult.");
  }

  const outcome = buildOutcome(decision, decision.decisionResult);
  decision.outcome = structuredClone(outcome);

  await touchDecision(decision);

  return structuredClone(outcome);
}

export async function completeDecision(decisionId: string): Promise<CollectiveDecision | null> {
  const decision = getMutableDecision(decisionId);

  if (!decision) {
    return null;
  }

  assertValidTransition(decision.status, "Completed");
  await calculateDecisionResult(decisionId);
  await determineOutcome(decisionId);

  const completed = getMutableDecision(decisionId);

  if (!completed) {
    return null;
  }

  completed.status = "Completed";
  completed.timeline.completedAt = new Date().toISOString();

  return touchDecision(completed);
}

export async function submitParticipantDecision(
  decisionId: string,
  participantDecision: ParticipantDecision,
): Promise<CollectiveDecision | null> {
  const decision = getMutableDecision(decisionId);

  if (!decision) {
    return null;
  }

  if (decision.status !== "Active") {
    throw new Error("Participant Decisions can only be submitted while the decision is Active.");
  }

  if (
    !(await isParticipantEligible(
      participantDecision.participantId,
      decision.ballot.eligibilityRules,
    ))
  ) {
    throw new Error(`Participant "${participantDecision.participantId}" is not eligible.`);
  }

  if (participantDecision.ballotId !== decision.ballot.ballotId) {
    throw new Error(`Ballot "${participantDecision.ballotId}" does not match the active ballot.`);
  }

  const hasActiveDecision = decision.participantDecisions.some(
    (entry) =>
      entry.participantId === participantDecision.participantId && entry.status === "submitted",
  );

  if (hasActiveDecision) {
    throw new Error(
      `Participant "${participantDecision.participantId}" already submitted a decision.`,
    );
  }

  for (const optionId of participantDecision.selectedOptionIds) {
    const optionExists = decision.ballot.options.some((option) => option.optionId === optionId);

    if (!optionExists) {
      throw new Error(`Decision option "${optionId}" was not found.`);
    }
  }

  const nextParticipantDecisions = [
    ...decision.participantDecisions,
    structuredClone(participantDecision),
  ];
  assertParticipantDecisionsImmutable(decision.participantDecisions, nextParticipantDecisions);
  decision.participantDecisions = nextParticipantDecisions;

  return touchDecision(decision);
}
