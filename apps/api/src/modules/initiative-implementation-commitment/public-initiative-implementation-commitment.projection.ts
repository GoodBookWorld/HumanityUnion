import type {
  InitiativeImplementationCommitment,
  InitiativeImplementationCommitmentMetrics,
  PublicInitiativeImplementationCommitmentListItem,
  PublicInitiativeImplementationCommitmentProjection,
} from "@hu/types";

import { getMemberById } from "../member/member.store.js";
import {
  getCommitmentById,
  listCommitmentsByInitiative,
  listPublicCommitmentsByDecision,
  listPublicCommitmentsByInitiative,
} from "./initiative-implementation-commitment.store.js";

const PUBLIC_STATUSES = new Set<InitiativeImplementationCommitment["status"]>([
  "published",
  "withdrawn",
  "completed",
]);

function resolveAuthorDisplayName(participantId: string): string {
  const member = getMemberById(participantId);

  return member?.profile.displayName ?? "Unknown Participant";
}

function toPublicStatus(
  status: InitiativeImplementationCommitment["status"],
): PublicInitiativeImplementationCommitmentProjection["status"] {
  if (!PUBLIC_STATUSES.has(status)) {
    throw new Error("Implementation commitment status is not publicly visible.");
  }

  return status as PublicInitiativeImplementationCommitmentProjection["status"];
}

function toPublicListItem(
  commitment: InitiativeImplementationCommitment,
): PublicInitiativeImplementationCommitmentListItem {
  return {
    commitmentId: commitment.commitmentId,
    decisionId: commitment.decisionId,
    title: commitment.commitmentTitle,
    summary: commitment.commitmentSummary,
    organization: commitment.organizationName,
    authorDisplayName: resolveAuthorDisplayName(commitment.participantId),
    commitmentScope: commitment.commitmentScope,
    status: toPublicStatus(commitment.status),
    expectedStartDate: commitment.expectedStartDate,
    expectedCompletionDate: commitment.expectedCompletionDate,
    publishedAt: commitment.publishedAt,
    withdrawnAt: commitment.withdrawnAt,
    completedAt: commitment.completedAt,
  };
}

export function toPublicInitiativeImplementationCommitmentProjection(
  commitment: InitiativeImplementationCommitment,
): PublicInitiativeImplementationCommitmentProjection {
  return {
    commitmentId: commitment.commitmentId,
    initiativeId: commitment.initiativeId,
    decisionId: commitment.decisionId,
    title: commitment.commitmentTitle,
    summary: commitment.commitmentSummary,
    organization: commitment.organizationName,
    authorDisplayName: resolveAuthorDisplayName(commitment.participantId),
    commitmentScope: commitment.commitmentScope,
    status: toPublicStatus(commitment.status),
    expectedStartDate: commitment.expectedStartDate,
    expectedCompletionDate: commitment.expectedCompletionDate,
    publishedAt: commitment.publishedAt,
    withdrawnAt: commitment.withdrawnAt,
    completedAt: commitment.completedAt,
  };
}

export function computeInitiativeImplementationCommitmentMetrics(
  initiativeId: string,
): InitiativeImplementationCommitmentMetrics {
  const commitments = listCommitmentsByInitiative(initiativeId);

  return {
    commitmentCount: commitments.length,
    publishedCommitments: commitments.filter((commitment) => commitment.status === "published")
      .length,
    completedCommitments: commitments.filter((commitment) => commitment.status === "completed")
      .length,
    withdrawnCommitments: commitments.filter((commitment) => commitment.status === "withdrawn")
      .length,
  };
}

export function listPublicInitiativeImplementationCommitmentsForInitiative(
  initiativeId: string,
): PublicInitiativeImplementationCommitmentListItem[] {
  return listPublicCommitmentsByInitiative(initiativeId).map((commitment) =>
    toPublicListItem(commitment),
  );
}

export function listPublicInitiativeImplementationCommitmentsForDecision(
  decisionId: string,
): PublicInitiativeImplementationCommitmentListItem[] {
  return listPublicCommitmentsByDecision(decisionId).map((commitment) =>
    toPublicListItem(commitment),
  );
}

export function getPublicInitiativeImplementationCommitment(
  commitmentId: string,
): PublicInitiativeImplementationCommitmentProjection | null {
  const commitment = getCommitmentById(commitmentId);

  if (!commitment || !PUBLIC_STATUSES.has(commitment.status)) {
    return null;
  }

  return toPublicInitiativeImplementationCommitmentProjection(commitment);
}
