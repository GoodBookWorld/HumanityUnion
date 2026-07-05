import type { InitiativeImprovementProposal } from "@hu/types";

import { resolveInitiativeImprovementProposalPersistenceAdapter } from "./persistence/resolve-initiative-improvement-proposal-persistence.js";
import { snapshotFromProposals } from "./persistence/initiative-improvement-proposal-persistence.types.js";

export interface InitiativeImprovementProposalUpdate {
  targetSection?: string;
  currentIssue?: string;
  proposedChange?: string;
  rationale?: string;
  expectedImprovement?: string;
  references?: string;
  status?: InitiativeImprovementProposal["status"];
  decidedAt?: string;
  decisionNote?: string;
}

const PUBLIC_STATUSES = new Set<InitiativeImprovementProposal["status"]>([
  "submitted",
  "accepted",
  "partially_accepted",
  "declined",
]);

const persistence = resolveInitiativeImprovementProposalPersistenceAdapter();

function loadProposalsMap(): Map<string, InitiativeImprovementProposal> {
  const snapshot = persistence.load();

  return new Map<string, InitiativeImprovementProposal>(
    Object.entries(snapshot.proposals).map(([proposalId, proposal]) => [
      proposalId,
      structuredClone(proposal),
    ]),
  );
}

function persistProposalsMap(proposals: Map<string, InitiativeImprovementProposal>): void {
  persistence.save(snapshotFromProposals(proposals));
}

const proposals = loadProposalsMap();

function sortByRecency(
  left: InitiativeImprovementProposal,
  right: InitiativeImprovementProposal,
): number {
  const leftTime = left.decidedAt ?? left.updatedAt;
  const rightTime = right.decidedAt ?? right.updatedAt;
  return rightTime.localeCompare(leftTime);
}

export function getProposalById(proposalId: string): InitiativeImprovementProposal | null {
  const proposal = proposals.get(proposalId);

  return proposal ? structuredClone(proposal) : null;
}

export function listProposals(): InitiativeImprovementProposal[] {
  return Array.from(proposals.values(), (proposal) => structuredClone(proposal));
}

export function listProposalsByAuthor(authorId: string): InitiativeImprovementProposal[] {
  return listProposals().filter((proposal) => proposal.authorId === authorId);
}

export function listProposalsByInitiative(initiativeId: string): InitiativeImprovementProposal[] {
  return listProposals().filter((proposal) => proposal.initiativeId === initiativeId);
}

export function listProposalsByAnalysis(analysisId: string): InitiativeImprovementProposal[] {
  return listProposals().filter((proposal) => proposal.analysisId === analysisId);
}

export function listPublicProposalsByInitiative(
  initiativeId: string,
): InitiativeImprovementProposal[] {
  return listProposalsByInitiative(initiativeId)
    .filter((proposal) => PUBLIC_STATUSES.has(proposal.status))
    .sort(sortByRecency);
}

export function listPublicProposalsByAnalysis(analysisId: string): InitiativeImprovementProposal[] {
  return listProposalsByAnalysis(analysisId)
    .filter((proposal) => PUBLIC_STATUSES.has(proposal.status))
    .sort(sortByRecency);
}

export function listSubmittedProposalsByInitiative(
  initiativeId: string,
): InitiativeImprovementProposal[] {
  return listProposalsByInitiative(initiativeId)
    .filter((proposal) => proposal.status === "submitted")
    .sort(sortByRecency);
}

export function createProposal(
  proposal: InitiativeImprovementProposal,
): InitiativeImprovementProposal {
  proposals.set(proposal.proposalId, structuredClone(proposal));
  persistProposalsMap(proposals);

  return structuredClone(proposal);
}

export function updateProposal(
  proposalId: string,
  update: InitiativeImprovementProposalUpdate,
): InitiativeImprovementProposal | null {
  const proposal = proposals.get(proposalId);

  if (!proposal) {
    return null;
  }

  if (update.targetSection !== undefined) {
    proposal.targetSection = update.targetSection;
  }

  if (update.currentIssue !== undefined) {
    proposal.currentIssue = update.currentIssue;
  }

  if (update.proposedChange !== undefined) {
    proposal.proposedChange = update.proposedChange;
  }

  if (update.rationale !== undefined) {
    proposal.rationale = update.rationale;
  }

  if (update.expectedImprovement !== undefined) {
    proposal.expectedImprovement = update.expectedImprovement;
  }

  if (update.references !== undefined) {
    proposal.references = update.references;
  }

  if (update.status !== undefined) {
    proposal.status = update.status;
  }

  if (update.decidedAt !== undefined) {
    proposal.decidedAt = update.decidedAt;
  }

  if (update.decisionNote !== undefined) {
    proposal.decisionNote = update.decisionNote;
  }

  proposal.updatedAt = new Date().toISOString();

  persistProposalsMap(proposals);

  return structuredClone(proposal);
}
