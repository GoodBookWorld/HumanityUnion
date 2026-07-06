import type {
  InitiativeImplementationCommitment,
  InitiativeImplementationCommitmentStatus,
} from "@hu/types";
import {
  canTransitionInitiativeImplementationCommitment,
  isInitiativeImplementationCommitmentTerminal,
} from "@hu/types";

import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { assertInitiativeImplementationCommitmentEligible } from "./initiative-implementation-commitment-eligibility.js";
import {
  createCommitment,
  getCommitmentById,
  listCommitmentsByDecision,
  listCommitmentsByParticipant,
  updateCommitment,
} from "./initiative-implementation-commitment.store.js";

export interface CreateInitiativeImplementationCommitmentDraftInput {
  initiativeId: string;
  decisionId: string;
  organizationName?: string;
  commitmentTitle: string;
  commitmentSummary: string;
  commitmentScope: string;
  expectedStartDate?: string;
  expectedCompletionDate?: string;
}

export interface UpdateInitiativeImplementationCommitmentDraftInput {
  organizationName?: string;
  commitmentTitle?: string;
  commitmentSummary?: string;
  commitmentScope?: string;
  expectedStartDate?: string;
  expectedCompletionDate?: string;
}

function getOwnedCommitment(
  commitmentId: string,
  identity: RequestIdentity,
): InitiativeImplementationCommitment {
  const commitment = getCommitmentById(commitmentId);

  if (!commitment) {
    throw new Error("Implementation commitment not found.");
  }

  if (commitment.participantId !== identity.participantId) {
    throw new Error("You do not have access to this implementation commitment.");
  }

  return commitment;
}

function assertTransitionAllowed(
  commitment: InitiativeImplementationCommitment,
  nextStatus: InitiativeImplementationCommitmentStatus,
): void {
  if (isInitiativeImplementationCommitmentTerminal(commitment.status)) {
    throw new Error(
      `Implementation commitment in status "${commitment.status}" cannot be changed.`,
    );
  }

  if (!canTransitionInitiativeImplementationCommitment(commitment.status, nextStatus)) {
    throw new Error(
      `Implementation commitment cannot transition from "${commitment.status}" to "${nextStatus}".`,
    );
  }
}

function assertDraftEditable(commitment: InitiativeImplementationCommitment): void {
  if (commitment.status !== "draft") {
    throw new Error("Only draft implementation commitments can be edited.");
  }
}

export function listMyInitiativeImplementationCommitments(
  identity: RequestIdentity,
): InitiativeImplementationCommitment[] {
  return listCommitmentsByParticipant(identity.participantId);
}

export function listMyInitiativeImplementationCommitmentsForDecision(
  identity: RequestIdentity,
  decisionId: string,
): InitiativeImplementationCommitment[] {
  return listCommitmentsByDecision(decisionId).filter(
    (commitment) => commitment.participantId === identity.participantId,
  );
}

export function getMyInitiativeImplementationCommitment(
  identity: RequestIdentity,
  commitmentId: string,
): InitiativeImplementationCommitment {
  return getOwnedCommitment(commitmentId, identity);
}

export function createInitiativeImplementationCommitmentDraft(
  identity: RequestIdentity,
  input: CreateInitiativeImplementationCommitmentDraftInput,
): InitiativeImplementationCommitment {
  assertInitiativeImplementationCommitmentEligible(input.initiativeId, input.decisionId);

  const now = new Date().toISOString();

  const commitment: InitiativeImplementationCommitment = {
    commitmentId: `implementation-commitment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    initiativeId: input.initiativeId,
    decisionId: input.decisionId,
    participantId: identity.participantId,
    organizationName: input.organizationName,
    commitmentTitle: input.commitmentTitle,
    commitmentSummary: input.commitmentSummary,
    commitmentScope: input.commitmentScope,
    expectedStartDate: input.expectedStartDate,
    expectedCompletionDate: input.expectedCompletionDate,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };

  return createCommitment(commitment);
}

export function updateInitiativeImplementationCommitmentDraft(
  identity: RequestIdentity,
  commitmentId: string,
  input: UpdateInitiativeImplementationCommitmentDraftInput,
): InitiativeImplementationCommitment {
  const commitment = getOwnedCommitment(commitmentId, identity);

  assertDraftEditable(commitment);

  const updated = updateCommitment(commitmentId, input);

  if (!updated) {
    throw new Error("Implementation commitment not found.");
  }

  return updated;
}

export function publishInitiativeImplementationCommitment(
  identity: RequestIdentity,
  commitmentId: string,
): InitiativeImplementationCommitment {
  const commitment = getOwnedCommitment(commitmentId, identity);

  assertTransitionAllowed(commitment, "published");

  const updated = updateCommitment(commitmentId, {
    status: "published",
    publishedAt: new Date().toISOString(),
  });

  if (!updated) {
    throw new Error("Implementation commitment not found.");
  }

  return updated;
}

export function withdrawInitiativeImplementationCommitment(
  identity: RequestIdentity,
  commitmentId: string,
): InitiativeImplementationCommitment {
  const commitment = getOwnedCommitment(commitmentId, identity);

  assertTransitionAllowed(commitment, "withdrawn");

  const updated = updateCommitment(commitmentId, {
    status: "withdrawn",
    withdrawnAt: new Date().toISOString(),
  });

  if (!updated) {
    throw new Error("Implementation commitment not found.");
  }

  return updated;
}

export function completeInitiativeImplementationCommitment(
  identity: RequestIdentity,
  commitmentId: string,
): InitiativeImplementationCommitment {
  const commitment = getOwnedCommitment(commitmentId, identity);

  assertTransitionAllowed(commitment, "completed");

  const updated = updateCommitment(commitmentId, {
    status: "completed",
    completedAt: new Date().toISOString(),
  });

  if (!updated) {
    throw new Error("Implementation commitment not found.");
  }

  return updated;
}
