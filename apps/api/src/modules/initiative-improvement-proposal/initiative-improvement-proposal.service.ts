import type { InitiativeImprovementProposal } from "@hu/types";

import { getAnalysisById } from "../initiative-collaborative-analysis/initiative-collaborative-analysis.store.js";
import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { assertInitiativeOwnership } from "../initiatives/initiative-ownership.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { assertInitiativeImprovementProposalOwnership } from "./initiative-improvement-proposal-ownership.js";
import {
  createProposal,
  getProposalById,
  listProposalsByAnalysis,
  listProposalsByAuthor,
  listProposalsByInitiative,
  listSubmittedProposalsByInitiative,
  updateProposal,
} from "./initiative-improvement-proposal.store.js";
import {
  type CreateInitiativeImprovementProposalDraftInput,
  type DecideInitiativeImprovementProposalInput,
  type SaveInitiativeImprovementProposalDraftInput,
  validateInitiativeImprovementProposalForSubmission,
} from "./initiative-improvement-proposal.validators.js";

function assertPublishedAnalysis(analysisId: string): {
  initiativeId: string;
} {
  const analysis = getAnalysisById(analysisId);

  if (!analysis) {
    throw new Error("Analysis not found.");
  }

  if (analysis.status !== "published") {
    throw new Error("Proposals can only be created from published analyses.");
  }

  return { initiativeId: analysis.initiativeId };
}

function getOwnedProposal(
  proposalId: string,
  identity: RequestIdentity,
): InitiativeImprovementProposal {
  const proposal = getProposalById(proposalId);

  if (!proposal) {
    throw new Error("Improvement proposal not found.");
  }

  assertInitiativeImprovementProposalOwnership(proposal, identity);

  return proposal;
}

function assertDraftStatus(proposal: InitiativeImprovementProposal): void {
  if (proposal.status !== "draft") {
    throw new Error("Only draft proposals can be edited or submitted from this workflow.");
  }
}

function assertAuthorArchivableStatus(proposal: InitiativeImprovementProposal): void {
  if (proposal.status === "archived") {
    throw new Error("Improvement proposal is already archived.");
  }

  if (
    proposal.status === "accepted" ||
    proposal.status === "partially_accepted" ||
    proposal.status === "declined"
  ) {
    throw new Error("Decided proposals cannot be archived by the author.");
  }
}

function assertSubmittedStatus(proposal: InitiativeImprovementProposal): void {
  if (proposal.status !== "submitted") {
    throw new Error("Only submitted proposals can receive a steward decision.");
  }
}

function getInitiativeForStewardDecision(
  initiativeId: string,
  identity: RequestIdentity,
): NonNullable<ReturnType<typeof getInitiativeById>> {
  const initiative = getInitiativeById(initiativeId);

  if (!initiative) {
    throw new Error("Initiative not found.");
  }

  assertInitiativeOwnership(initiative, identity);

  return initiative;
}

export function listMyInitiativeImprovementProposals(
  identity: RequestIdentity,
): InitiativeImprovementProposal[] {
  return listProposalsByAuthor(identity.participantId);
}

export function listMyInitiativeImprovementProposalsForInitiative(
  identity: RequestIdentity,
  initiativeId: string,
): InitiativeImprovementProposal[] {
  return listProposalsByInitiative(initiativeId).filter(
    (proposal) => proposal.authorId === identity.participantId,
  );
}

export function listMyInitiativeImprovementProposalsForAnalysis(
  identity: RequestIdentity,
  analysisId: string,
): InitiativeImprovementProposal[] {
  return listProposalsByAnalysis(analysisId).filter(
    (proposal) => proposal.authorId === identity.participantId,
  );
}

export function listSubmittedInitiativeImprovementProposalsForSteward(
  identity: RequestIdentity,
  initiativeId: string,
): InitiativeImprovementProposal[] {
  getInitiativeForStewardDecision(initiativeId, identity);

  return listSubmittedProposalsByInitiative(initiativeId);
}

export function getMyInitiativeImprovementProposal(
  identity: RequestIdentity,
  proposalId: string,
): InitiativeImprovementProposal {
  return getOwnedProposal(proposalId, identity);
}

export function createInitiativeImprovementProposalDraft(
  identity: RequestIdentity,
  input: CreateInitiativeImprovementProposalDraftInput,
): InitiativeImprovementProposal {
  const { initiativeId } = assertPublishedAnalysis(input.analysisId);

  const now = new Date().toISOString();
  const proposalId = `initiative-proposal-${Date.now()}`;

  const proposal: InitiativeImprovementProposal = {
    proposalId,
    initiativeId,
    analysisId: input.analysisId,
    authorId: identity.participantId,
    targetSection: input.targetSection,
    currentIssue: input.currentIssue,
    proposedChange: input.proposedChange,
    rationale: input.rationale,
    expectedImprovement: input.expectedImprovement,
    references: input.references,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };

  return createProposal(proposal);
}

export function saveInitiativeImprovementProposalDraft(
  identity: RequestIdentity,
  proposalId: string,
  input: SaveInitiativeImprovementProposalDraftInput,
): InitiativeImprovementProposal {
  const proposal = getOwnedProposal(proposalId, identity);

  assertDraftStatus(proposal);

  const updated = updateProposal(proposalId, input);

  if (!updated) {
    throw new Error("Improvement proposal not found.");
  }

  return updated;
}

export function submitInitiativeImprovementProposal(
  identity: RequestIdentity,
  proposalId: string,
): InitiativeImprovementProposal {
  const proposal = getOwnedProposal(proposalId, identity);

  assertDraftStatus(proposal);
  validateInitiativeImprovementProposalForSubmission(proposal);

  const updated = updateProposal(proposalId, {
    status: "submitted",
  });

  if (!updated) {
    throw new Error("Improvement proposal not found.");
  }

  return updated;
}

export function archiveInitiativeImprovementProposal(
  identity: RequestIdentity,
  proposalId: string,
): InitiativeImprovementProposal {
  const proposal = getOwnedProposal(proposalId, identity);

  assertAuthorArchivableStatus(proposal);

  const updated = updateProposal(proposalId, {
    status: "archived",
  });

  if (!updated) {
    throw new Error("Improvement proposal not found.");
  }

  return updated;
}

export function decideInitiativeImprovementProposal(
  identity: RequestIdentity,
  proposalId: string,
  input: DecideInitiativeImprovementProposalInput,
): InitiativeImprovementProposal {
  const proposal = getProposalById(proposalId);

  if (!proposal) {
    throw new Error("Improvement proposal not found.");
  }

  getInitiativeForStewardDecision(proposal.initiativeId, identity);
  assertSubmittedStatus(proposal);

  const decidedAt = new Date().toISOString();
  const updated = updateProposal(proposalId, {
    status: input.decision,
    decidedAt,
    decisionNote: input.decisionNote,
  });

  if (!updated) {
    throw new Error("Improvement proposal not found.");
  }

  return updated;
}
