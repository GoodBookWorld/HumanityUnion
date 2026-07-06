import type {
  InitiativeCollectiveDecision,
  InitiativeCollectiveDecisionStatus,
  ParticipationScope,
} from "@hu/types";
import {
  canTransitionInitiativeCollectiveDecision,
  isInitiativeCollectiveDecisionTerminal,
} from "@hu/types";

import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { assertInitiativeOwnership } from "../initiatives/initiative-ownership.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { getSessionById } from "../decision-session/decision-session.store.js";
import {
  assertInitiativeCollectiveDecisionEligible,
  assessInitiativeCollectiveDecisionEligibility,
} from "./initiative-collective-decision-eligibility.js";
import {
  createDecision,
  getDecisionById,
  getNextSequenceNumber,
  listDecisionsByInitiative,
  listDecisionsBySteward,
  updateDecision,
} from "./initiative-collective-decision.store.js";

export interface CreateInitiativeCollectiveDecisionDraftInput {
  initiativeId: string;
  decisionSessionId: string;
  participationScope: ParticipationScope;
  closesAt: string;
  supersedesDecisionId?: string;
}

function getOwnedDecision(
  decisionId: string,
  identity: RequestIdentity,
): InitiativeCollectiveDecision {
  const decision = getDecisionById(decisionId);

  if (!decision) {
    throw new Error("Collective decision not found.");
  }

  if (decision.stewardId !== identity.participantId) {
    throw new Error("You do not have access to this collective decision.");
  }

  return decision;
}

function assertTransitionAllowed(
  decision: InitiativeCollectiveDecision,
  nextStatus: InitiativeCollectiveDecisionStatus,
): void {
  if (isInitiativeCollectiveDecisionTerminal(decision.status)) {
    throw new Error(`Collective decision in status "${decision.status}" cannot be changed.`);
  }

  if (!canTransitionInitiativeCollectiveDecision(decision.status, nextStatus)) {
    throw new Error(
      `Collective decision cannot transition from "${decision.status}" to "${nextStatus}".`,
    );
  }
}

export function getInitiativeCollectiveDecisionEligibility(
  initiativeId: string,
  decisionSessionId: string,
) {
  return assessInitiativeCollectiveDecisionEligibility(initiativeId, decisionSessionId);
}

export function listMyInitiativeCollectiveDecisions(
  identity: RequestIdentity,
): InitiativeCollectiveDecision[] {
  return listDecisionsBySteward(identity.participantId);
}

export function listMyInitiativeCollectiveDecisionsForInitiative(
  identity: RequestIdentity,
  initiativeId: string,
): InitiativeCollectiveDecision[] {
  const initiative = getInitiativeById(initiativeId);

  if (!initiative) {
    throw new Error("Initiative not found.");
  }

  assertInitiativeOwnership(initiative, identity);

  return listDecisionsByInitiative(initiativeId).filter(
    (decision) => decision.stewardId === identity.participantId,
  );
}

export function getMyInitiativeCollectiveDecision(
  identity: RequestIdentity,
  decisionId: string,
): InitiativeCollectiveDecision {
  return getOwnedDecision(decisionId, identity);
}

export function createInitiativeCollectiveDecisionDraft(
  identity: RequestIdentity,
  input: CreateInitiativeCollectiveDecisionDraftInput,
): InitiativeCollectiveDecision {
  const initiative = getInitiativeById(input.initiativeId);

  if (!initiative) {
    throw new Error("Initiative not found.");
  }

  assertInitiativeOwnership(initiative, identity);
  assertInitiativeCollectiveDecisionEligible(input.initiativeId, input.decisionSessionId);

  const session = getSessionById(input.decisionSessionId);

  if (!session) {
    throw new Error("Decision session not found.");
  }

  if (input.supersedesDecisionId) {
    const priorDecision = getDecisionById(input.supersedesDecisionId);

    if (!priorDecision) {
      throw new Error("Prior collective decision not found.");
    }

    if (priorDecision.initiativeId !== input.initiativeId) {
      throw new Error("Prior collective decision does not belong to this initiative.");
    }

    if (!isInitiativeCollectiveDecisionTerminal(priorDecision.status)) {
      throw new Error("Prior collective decision must be closed or cancelled before reopening.");
    }
  }

  const existingForSession = listDecisionsByInitiative(input.initiativeId).some(
    (decision) => decision.decisionSessionId === input.decisionSessionId,
  );

  if (existingForSession) {
    throw new Error("A collective decision already exists for this decision session.");
  }

  const now = new Date().toISOString();

  const decision: InitiativeCollectiveDecision = {
    decisionId: `collective-decision-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    initiativeId: input.initiativeId,
    decisionSessionId: input.decisionSessionId,
    stewardId: identity.participantId,
    sequenceNumber: getNextSequenceNumber(input.initiativeId),
    participationScope: input.participationScope,
    status: "draft",
    question: session.decisionQuestion,
    closesAt: input.closesAt,
    supersedesDecisionId: input.supersedesDecisionId,
    createdAt: now,
    updatedAt: now,
  };

  return createDecision(decision);
}

export function openInitiativeCollectiveDecision(
  identity: RequestIdentity,
  decisionId: string,
): InitiativeCollectiveDecision {
  const decision = getOwnedDecision(decisionId, identity);

  assertTransitionAllowed(decision, "opened");

  const openedAt = new Date().toISOString();

  if (Date.parse(decision.closesAt) <= Date.parse(openedAt)) {
    throw new Error("Closing date must be after the decision opens.");
  }

  const updated = updateDecision(decisionId, {
    status: "opened",
    openedAt,
  });

  if (!updated) {
    throw new Error("Collective decision not found.");
  }

  return updated;
}

export function closeInitiativeCollectiveDecision(
  identity: RequestIdentity,
  decisionId: string,
): InitiativeCollectiveDecision {
  const decision = getOwnedDecision(decisionId, identity);

  assertTransitionAllowed(decision, "closed");

  const updated = updateDecision(decisionId, {
    status: "closed",
    closedAt: new Date().toISOString(),
  });

  if (!updated) {
    throw new Error("Collective decision not found.");
  }

  return updated;
}

export function cancelInitiativeCollectiveDecision(
  identity: RequestIdentity,
  decisionId: string,
): InitiativeCollectiveDecision {
  const decision = getOwnedDecision(decisionId, identity);

  assertTransitionAllowed(decision, "cancelled");

  const updated = updateDecision(decisionId, {
    status: "cancelled",
    cancelledAt: new Date().toISOString(),
  });

  if (!updated) {
    throw new Error("Collective decision not found.");
  }

  return updated;
}
