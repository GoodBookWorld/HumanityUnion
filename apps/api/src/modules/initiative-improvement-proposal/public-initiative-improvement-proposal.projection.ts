import type {
  InitiativeImprovementProposal,
  InitiativeImprovementProposalMetrics,
  PublicInitiativeImprovementProposalListItem,
  PublicInitiativeImprovementProposalProjection,
} from "@hu/types";

import { getMemberById } from "../member/member.store.js";
import {
  getProposalById,
  listPublicProposalsByAnalysis,
  listPublicProposalsByInitiative,
} from "./initiative-improvement-proposal.store.js";

const PUBLIC_STATUSES = new Set<InitiativeImprovementProposal["status"]>([
  "submitted",
  "accepted",
  "partially_accepted",
  "declined",
]);

function resolveAuthorDisplayName(authorId: string): string {
  const member = getMemberById(authorId);

  return member?.profile.displayName ?? "Unknown Author";
}

function toPublicStatus(
  status: InitiativeImprovementProposal["status"],
): PublicInitiativeImprovementProposalProjection["status"] {
  if (!PUBLIC_STATUSES.has(status)) {
    throw new Error("Proposal status is not publicly visible.");
  }

  return status as PublicInitiativeImprovementProposalProjection["status"];
}

export function toPublicInitiativeImprovementProposalProjection(
  proposal: InitiativeImprovementProposal,
): PublicInitiativeImprovementProposalProjection {
  return {
    proposalId: proposal.proposalId,
    initiativeId: proposal.initiativeId,
    analysisId: proposal.analysisId,
    targetSection: proposal.targetSection,
    currentIssue: proposal.currentIssue,
    proposedChange: proposal.proposedChange,
    rationale: proposal.rationale,
    expectedImprovement: proposal.expectedImprovement,
    references: proposal.references,
    status: toPublicStatus(proposal.status),
    authorDisplayName: resolveAuthorDisplayName(proposal.authorId),
    createdAt: proposal.createdAt,
    updatedAt: proposal.updatedAt,
    decidedAt: proposal.decidedAt,
    decisionNote: proposal.decisionNote,
    implementedInVersion: proposal.implementedInVersion ?? null,
  };
}

export function toPublicInitiativeImprovementProposalListItem(
  proposal: InitiativeImprovementProposal,
): PublicInitiativeImprovementProposalListItem {
  return {
    proposalId: proposal.proposalId,
    targetSection: proposal.targetSection,
    proposedChange: proposal.proposedChange,
    status: toPublicStatus(proposal.status),
    authorDisplayName: resolveAuthorDisplayName(proposal.authorId),
    updatedAt: proposal.updatedAt,
    decidedAt: proposal.decidedAt,
    implementedInVersion: proposal.implementedInVersion ?? null,
  };
}

export function computeInitiativeImprovementProposalMetrics(
  initiativeId: string,
): InitiativeImprovementProposalMetrics {
  const proposals = listPublicProposalsByInitiative(initiativeId);

  return {
    submittedCount: proposals.filter((proposal) => proposal.status === "submitted").length,
    acceptedCount: proposals.filter((proposal) => proposal.status === "accepted").length,
    partiallyAcceptedCount: proposals.filter((proposal) => proposal.status === "partially_accepted")
      .length,
    declinedCount: proposals.filter((proposal) => proposal.status === "declined").length,
  };
}

export function listPublicInitiativeImprovementProposals(
  initiativeId: string,
): PublicInitiativeImprovementProposalListItem[] {
  return listPublicProposalsByInitiative(initiativeId).map((proposal) =>
    toPublicInitiativeImprovementProposalListItem(proposal),
  );
}

export function listPublicInitiativeImprovementProposalsForAnalysis(
  analysisId: string,
): PublicInitiativeImprovementProposalListItem[] {
  return listPublicProposalsByAnalysis(analysisId).map((proposal) =>
    toPublicInitiativeImprovementProposalListItem(proposal),
  );
}

export function getPublicInitiativeImprovementProposal(
  proposalId: string,
): PublicInitiativeImprovementProposalProjection | null {
  const proposal = getProposalById(proposalId);

  if (!proposal || !PUBLIC_STATUSES.has(proposal.status)) {
    return null;
  }

  return toPublicInitiativeImprovementProposalProjection(proposal);
}
