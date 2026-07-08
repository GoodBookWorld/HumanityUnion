import type { InitiativeImplementationCommitment } from "@hu/types";

import { resolveInitiativeImplementationCommitmentPersistenceAdapter } from "./persistence/resolve-initiative-implementation-commitment-persistence.js";
import { snapshotFromCommitments } from "./persistence/initiative-implementation-commitment-persistence.types.js";

export interface InitiativeImplementationCommitmentUpdate {
  organizationName?: string;
  commitmentTitle?: string;
  commitmentSummary?: string;
  commitmentScope?: string;
  expectedStartDate?: string;
  expectedCompletionDate?: string;
  status?: InitiativeImplementationCommitment["status"];
  publishedAt?: string;
  withdrawnAt?: string;
  completedAt?: string;
}

const PUBLIC_STATUSES = new Set<InitiativeImplementationCommitment["status"]>([
  "published",
  "withdrawn",
  "completed",
]);

const persistence = resolveInitiativeImplementationCommitmentPersistenceAdapter();

function loadCommitmentsMap(): Map<string, InitiativeImplementationCommitment> {
  const snapshot = persistence.load();

  return new Map<string, InitiativeImplementationCommitment>(
    Object.entries(snapshot.commitments).map(([commitmentId, commitment]) => [
      commitmentId,
      structuredClone(commitment),
    ]),
  );
}

function persistCommitmentsMap(commitments: Map<string, InitiativeImplementationCommitment>): void {
  persistence.save(snapshotFromCommitments(commitments));
}

const commitments = loadCommitmentsMap();

export function getCommitmentById(commitmentId: string): InitiativeImplementationCommitment | null {
  const commitment = commitments.get(commitmentId);

  return commitment ? structuredClone(commitment) : null;
}

export function listCommitments(): InitiativeImplementationCommitment[] {
  return Array.from(commitments.values(), (commitment) => structuredClone(commitment));
}

export function listCommitmentsByInitiative(
  initiativeId: string,
): InitiativeImplementationCommitment[] {
  return listCommitments().filter((commitment) => commitment.initiativeId === initiativeId);
}

export function listCommitmentsByDecision(
  decisionId: string,
): InitiativeImplementationCommitment[] {
  return listCommitments().filter((commitment) => commitment.decisionId === decisionId);
}

export function listCommitmentsByParticipant(
  participantId: string,
): InitiativeImplementationCommitment[] {
  return listCommitments().filter((commitment) => commitment.participantId === participantId);
}

export function listPublicCommitmentsByInitiative(
  initiativeId: string,
): InitiativeImplementationCommitment[] {
  return listCommitmentsByInitiative(initiativeId)
    .filter((commitment) => PUBLIC_STATUSES.has(commitment.status))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function listPublicCommitmentsByDecision(
  decisionId: string,
): InitiativeImplementationCommitment[] {
  return listCommitmentsByDecision(decisionId)
    .filter((commitment) => PUBLIC_STATUSES.has(commitment.status))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function createCommitment(
  commitment: InitiativeImplementationCommitment,
): InitiativeImplementationCommitment {
  commitments.set(commitment.commitmentId, structuredClone(commitment));
  persistCommitmentsMap(commitments);

  return structuredClone(commitment);
}

export function updateCommitment(
  commitmentId: string,
  update: InitiativeImplementationCommitmentUpdate,
): InitiativeImplementationCommitment | null {
  const commitment = commitments.get(commitmentId);

  if (!commitment) {
    return null;
  }

  if (update.organizationName !== undefined) {
    commitment.organizationName = update.organizationName;
  }

  if (update.commitmentTitle !== undefined) {
    commitment.commitmentTitle = update.commitmentTitle;
  }

  if (update.commitmentSummary !== undefined) {
    commitment.commitmentSummary = update.commitmentSummary;
  }

  if (update.commitmentScope !== undefined) {
    commitment.commitmentScope = update.commitmentScope;
  }

  if (update.expectedStartDate !== undefined) {
    commitment.expectedStartDate = update.expectedStartDate;
  }

  if (update.expectedCompletionDate !== undefined) {
    commitment.expectedCompletionDate = update.expectedCompletionDate;
  }

  if (update.status !== undefined) {
    commitment.status = update.status;
  }

  if (update.publishedAt !== undefined) {
    commitment.publishedAt = update.publishedAt;
  }

  if (update.withdrawnAt !== undefined) {
    commitment.withdrawnAt = update.withdrawnAt;
  }

  if (update.completedAt !== undefined) {
    commitment.completedAt = update.completedAt;
  }

  commitment.updatedAt = new Date().toISOString();

  persistCommitmentsMap(commitments);

  return structuredClone(commitment);
}

export function getPersistenceMode(): "file" | "memory" | "mongodb" {
  return persistence.mode;
}
