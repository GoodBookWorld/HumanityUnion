import type {
  ImplementationCommitmentProposalHistoryEntry,
  ImplementationCommitmentTraceability,
  InitiativeImplementationCommitment,
  InitiativeImplementationCommitmentProposalStatus,
} from "@hu/types";

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
  /** Initiative Lifecycle — Part I fields (Package publish / proposal lifecycle). */
  packageId?: string | null;
  approvedAction?: string | null;
  actionIndex?: number | null;
  proposalStatus?: InitiativeImplementationCommitmentProposalStatus | null;
  suggestedResponsibleRole?: string | null;
  priority?: string | null;
  requiredResources?: string[] | null;
  relatedRisks?: string[] | null;
  references?: string[] | null;
  proposedByParticipantId?: string | null;
  /**
   * Null for package `unassigned`; set on Accept / Take Commitment.
   * Never interpret a non-null value alone as accepted responsibility.
   */
  participantId?: string | null;
  acceptedAt?: string | null;
  declinedAt?: string | null;
  pendingProposedParticipantId?: string | null;
  proposedAt?: string | null;
  proposalHistory?: ImplementationCommitmentProposalHistoryEntry[] | null;
  traceability?: ImplementationCommitmentTraceability | null;
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

  if (update.packageId !== undefined) {
    commitment.packageId = update.packageId;
  }

  if (update.approvedAction !== undefined) {
    commitment.approvedAction = update.approvedAction;
  }

  if (update.actionIndex !== undefined) {
    commitment.actionIndex = update.actionIndex;
  }

  if (update.proposalStatus !== undefined) {
    commitment.proposalStatus = update.proposalStatus;
  }

  if (update.suggestedResponsibleRole !== undefined) {
    commitment.suggestedResponsibleRole = update.suggestedResponsibleRole;
  }

  if (update.priority !== undefined) {
    commitment.priority = update.priority;
  }

  if (update.requiredResources !== undefined) {
    commitment.requiredResources = update.requiredResources;
  }

  if (update.relatedRisks !== undefined) {
    commitment.relatedRisks = update.relatedRisks;
  }

  if (update.references !== undefined) {
    commitment.references = update.references;
  }

  if (update.proposedByParticipantId !== undefined) {
    commitment.proposedByParticipantId = update.proposedByParticipantId;
  }

  if (update.participantId !== undefined) {
    commitment.participantId = update.participantId;
  }

  if (update.acceptedAt !== undefined) {
    commitment.acceptedAt = update.acceptedAt;
  }

  if (update.declinedAt !== undefined) {
    commitment.declinedAt = update.declinedAt;
  }

  if (update.pendingProposedParticipantId !== undefined) {
    commitment.pendingProposedParticipantId = update.pendingProposedParticipantId;
  }

  if (update.proposedAt !== undefined) {
    commitment.proposedAt = update.proposedAt;
  }

  if (update.proposalHistory !== undefined) {
    commitment.proposalHistory = update.proposalHistory;
  }

  if (update.traceability !== undefined) {
    commitment.traceability = update.traceability;
  }

  commitment.updatedAt = new Date().toISOString();

  persistCommitmentsMap(commitments);

  return structuredClone(commitment);
}

/**
 * Pack 19A.3 — conditional Take transition.
 * Succeeds only while `status === "published"` and `proposalStatus === "unassigned"`.
 * Single-process atomic: sync Map check+update before persist (no silent overwrite).
 */
export function tryTakeUnassignedCommitment(
  commitmentId: string,
  actorParticipantId: string,
  acceptedAt: string,
): InitiativeImplementationCommitment | null {
  const commitment = commitments.get(commitmentId);

  if (!commitment) {
    return null;
  }

  if (commitment.status !== "published" || commitment.proposalStatus !== "unassigned") {
    return null;
  }

  commitment.participantId = actorParticipantId;
  commitment.proposalStatus = "accepted";
  commitment.acceptedAt = acceptedAt;
  commitment.updatedAt = new Date().toISOString();

  persistCommitmentsMap(commitments);

  return structuredClone(commitment);
}

/**
 * Pack 19A.5 — conditional re-propose: only while published + declined.
 */
export function tryReproposeDeclinedCommitment(
  commitmentId: string,
  nextParticipantId: string,
  proposedAt: string,
  proposedByParticipantId: string,
  historyEntry: ImplementationCommitmentProposalHistoryEntry,
): InitiativeImplementationCommitment | null {
  const commitment = commitments.get(commitmentId);

  if (!commitment) {
    return null;
  }

  if (commitment.status !== "published" || commitment.proposalStatus !== "declined") {
    return null;
  }

  const history = [...(commitment.proposalHistory ?? []), historyEntry];
  commitment.proposalHistory = history;
  commitment.participantId = nextParticipantId;
  commitment.proposalStatus = "proposed";
  commitment.proposedAt = proposedAt;
  commitment.proposedByParticipantId = proposedByParticipantId;
  commitment.declinedAt = null;
  commitment.acceptedAt = null;
  commitment.pendingProposedParticipantId = null;
  commitment.updatedAt = new Date().toISOString();

  persistCommitmentsMap(commitments);

  return structuredClone(commitment);
}

/**
 * Pack 19A.5 — conditional transfer initiate: accepted owner stays until Accept.
 */
export function tryInitiateResponsibilityTransfer(
  commitmentId: string,
  pendingProposedParticipantId: string,
  proposedAt: string,
): InitiativeImplementationCommitment | null {
  const commitment = commitments.get(commitmentId);

  if (!commitment) {
    return null;
  }

  if (
    commitment.status !== "published" ||
    commitment.proposalStatus !== "accepted" ||
    commitment.pendingProposedParticipantId
  ) {
    return null;
  }

  commitment.pendingProposedParticipantId = pendingProposedParticipantId;
  commitment.proposedAt = proposedAt;
  commitment.updatedAt = new Date().toISOString();

  persistCommitmentsMap(commitments);

  return structuredClone(commitment);
}

/**
 * Pack 19A.5 — replacement Accept while previous owner remains canonical until this succeeds.
 */
export function tryAcceptResponsibilityTransfer(
  commitmentId: string,
  actorParticipantId: string,
  acceptedAt: string,
  historyEntry: ImplementationCommitmentProposalHistoryEntry,
): InitiativeImplementationCommitment | null {
  const commitment = commitments.get(commitmentId);

  if (!commitment) {
    return null;
  }

  if (
    commitment.status !== "published" ||
    commitment.proposalStatus !== "accepted" ||
    commitment.pendingProposedParticipantId !== actorParticipantId
  ) {
    return null;
  }

  const history = [...(commitment.proposalHistory ?? []), historyEntry];
  commitment.proposalHistory = history;
  commitment.participantId = actorParticipantId;
  commitment.acceptedAt = acceptedAt;
  commitment.pendingProposedParticipantId = null;
  commitment.declinedAt = null;
  commitment.proposedAt = null;
  commitment.updatedAt = new Date().toISOString();

  persistCommitmentsMap(commitments);

  return structuredClone(commitment);
}

/**
 * Pack 19A.5 — decline a pending transfer without removing the current accepted owner.
 */
export function tryDeclineResponsibilityTransfer(
  commitmentId: string,
  actorParticipantId: string,
  historyEntry: ImplementationCommitmentProposalHistoryEntry,
): InitiativeImplementationCommitment | null {
  const commitment = commitments.get(commitmentId);

  if (!commitment) {
    return null;
  }

  if (
    commitment.status !== "published" ||
    commitment.proposalStatus !== "accepted" ||
    commitment.pendingProposedParticipantId !== actorParticipantId
  ) {
    return null;
  }

  const history = [...(commitment.proposalHistory ?? []), historyEntry];
  commitment.proposalHistory = history;
  commitment.pendingProposedParticipantId = null;
  commitment.proposedAt = null;
  commitment.updatedAt = new Date().toISOString();

  persistCommitmentsMap(commitments);

  return structuredClone(commitment);
}

export function getPersistenceMode(): "file" | "memory" | "mongodb" {
  return persistence.mode;
}

/**
 * Test-only cleanup helper (Recovery Task 15), mirroring
 * `deleteDecisionsByStewardIdForTests`
 * (`initiative-collective-decision.store.ts`, Recovery Task 09) and
 * `deleteParticipationAreasByParticipantIdForTests` (Recovery Task 13).
 * Deletes only commitments owned by the given `participantId`, leaving
 * unrelated records untouched. Not a general-purpose delete-all API.
 */
export function deleteCommitmentsByParticipantIdForTests(participantId: string): void {
  for (const [commitmentId, commitment] of commitments) {
    if (commitment.participantId === participantId) {
      commitments.delete(commitmentId);
    }
  }

  persistCommitmentsMap(commitments);
}
