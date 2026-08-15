import type {
  InitiativeImplementationCommitment,
  InitiativeImplementationCommitmentMetrics,
  PublicInitiativeImplementationCommitmentListItem,
  PublicInitiativeImplementationCommitmentProjection,
} from "@hu/types";

import { getMemberById } from "../member/member-access.js";
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

async function resolveAuthorDisplayName(participantId: string): Promise<string> {
  const member = await getMemberById(participantId);

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

async function toPublicListItem(
  commitment: InitiativeImplementationCommitment,
): Promise<PublicInitiativeImplementationCommitmentListItem> {
  return {
    commitmentId: commitment.commitmentId,
    decisionId: commitment.decisionId,
    title: commitment.commitmentTitle,
    summary: commitment.commitmentSummary,
    organization: commitment.organizationName,
    authorDisplayName: await resolveAuthorDisplayName(commitment.participantId),
    commitmentScope: commitment.commitmentScope,
    status: toPublicStatus(commitment.status),
    expectedStartDate: commitment.expectedStartDate,
    expectedCompletionDate: commitment.expectedCompletionDate,
    publishedAt: commitment.publishedAt,
    withdrawnAt: commitment.withdrawnAt,
    completedAt: commitment.completedAt,
    packageId: commitment.packageId ?? null,
    approvedAction: commitment.approvedAction ?? null,
    proposalStatus: commitment.proposalStatus ?? null,
    priority: commitment.priority ?? null,
  };
}

export async function toPublicInitiativeImplementationCommitmentProjection(
  commitment: InitiativeImplementationCommitment,
): Promise<PublicInitiativeImplementationCommitmentProjection> {
  return {
    commitmentId: commitment.commitmentId,
    initiativeId: commitment.initiativeId,
    decisionId: commitment.decisionId,
    title: commitment.commitmentTitle,
    summary: commitment.commitmentSummary,
    organization: commitment.organizationName,
    authorDisplayName: await resolveAuthorDisplayName(commitment.participantId),
    commitmentScope: commitment.commitmentScope,
    status: toPublicStatus(commitment.status),
    expectedStartDate: commitment.expectedStartDate,
    expectedCompletionDate: commitment.expectedCompletionDate,
    publishedAt: commitment.publishedAt,
    withdrawnAt: commitment.withdrawnAt,
    completedAt: commitment.completedAt,
    packageId: commitment.packageId ?? null,
    approvedAction: commitment.approvedAction ?? null,
    actionIndex: commitment.actionIndex ?? null,
    proposalStatus: commitment.proposalStatus ?? null,
    suggestedResponsibleRole: commitment.suggestedResponsibleRole ?? null,
    priority: commitment.priority ?? null,
    requiredResources: commitment.requiredResources ?? [],
    relatedRisks: commitment.relatedRisks ?? [],
    references: commitment.references ?? [],
    traceability: commitment.traceability ?? null,
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

export async function listPublicInitiativeImplementationCommitmentsForInitiative(
  initiativeId: string,
): Promise<PublicInitiativeImplementationCommitmentListItem[]> {
  const commitments = listPublicCommitmentsByInitiative(initiativeId);

  return Promise.all(commitments.map((commitment) => toPublicListItem(commitment)));
}

export async function listPublicInitiativeImplementationCommitmentsForDecision(
  decisionId: string,
): Promise<PublicInitiativeImplementationCommitmentListItem[]> {
  const commitments = listPublicCommitmentsByDecision(decisionId);

  return Promise.all(commitments.map((commitment) => toPublicListItem(commitment)));
}

export async function getPublicInitiativeImplementationCommitment(
  commitmentId: string,
): Promise<PublicInitiativeImplementationCommitmentProjection | null> {
  const commitment = getCommitmentById(commitmentId);

  if (!commitment || !PUBLIC_STATUSES.has(commitment.status)) {
    return null;
  }

  return await toPublicInitiativeImplementationCommitmentProjection(commitment);
}
