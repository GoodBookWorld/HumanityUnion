import type {
  DirectInitiativeAncestry,
  Initiative,
  InitiativeCollaborativeAnalysis,
  InitiativeImprovementProposal,
} from "@hu/types";

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
import { emitCivicNotificationEvent } from "../notifications/notification.service.js";
import { validateDirectInitiativeAncestry } from "../../shared/initiative-ancestry/index.js";

/**
 * Initiative Ancestry — Recovery Task 07.
 *
 * Initiative Improvement Proposal uses DIRECT Initiative ancestry: every
 * persisted proposal stores its own `initiativeId` (see `@hu/types`
 * `InitiativeImprovementProposal`), so a proposal remains traceable to its
 * Initiative even if the linked Collaborative Analysis is later archived or
 * becomes unavailable. Collaborative Analysis is an optional *analytical
 * source* that informs a proposal — it is never treated as the civic root,
 * and the Proposal does not own the Initiative, Analysis, Decision Session,
 * Collective Decision, implementation, or impact lifecycles.
 *
 * Contract note: the current `CreateInitiativeImprovementProposalDraftInput`
 * has no independent `initiativeId` field — `analysisId` is the sole,
 * mandatory input, and `initiativeId` has always been derived from the
 * referenced (published) Analysis. Because there is no second,
 * independently supplied `initiativeId` to compare against, the
 * "cross-Initiative parent mismatch" scenario described by
 * ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0.md cannot occur under the
 * current contract: `ancestry.initiativeId` is derived directly from
 * `analysis.initiativeId` below, so they are equal by construction. The
 * explicit equality assertion is kept as a defensive invariant guard (and
 * mapped to its own 409 below) so that any future change introducing a
 * second source cannot silently violate this invariant.
 *
 * As of this task, `createInitiativeImprovementProposalDraft` — not the
 * Express route — is the enforcement boundary: it validates the resolved
 * Initiative's existence via the shared `validateDirectInitiativeAncestry`
 * before any persistence is attempted. This closes a real pre-existing gap:
 * the previous implementation trusted `analysis.initiativeId` verbatim and
 * never confirmed the referenced Initiative still exists.
 *
 * Persistence is unchanged: proposals continue to store a plain
 * `initiativeId` string, not a nested ancestry object.
 */
export interface InitiativeImprovementProposalAncestryDependencies {
  readonly getAnalysis: (analysisId: string) => InitiativeCollaborativeAnalysis | null;
  readonly getInitiative: (initiativeId: string) => Initiative | null;
}

const defaultInitiativeImprovementProposalAncestryDependencies: InitiativeImprovementProposalAncestryDependencies =
  {
    getAnalysis: getAnalysisById,
    getInitiative: getInitiativeById,
  };

async function assertEligibleAnalysisAndInitiativeAncestry(
  analysisId: string,
  deps: InitiativeImprovementProposalAncestryDependencies,
): Promise<{
  ancestry: DirectInitiativeAncestry;
  analysis: InitiativeCollaborativeAnalysis;
}> {
  const analysis = deps.getAnalysis(analysisId);

  if (!analysis) {
    throw new Error("Analysis not found.");
  }

  if (analysis.status !== "published") {
    throw new Error("Proposals can only be created from published analyses.");
  }

  const resolvedInitiativeBox: { value: Initiative | null } = { value: null };

  // Enforcement boundary: confirms the Analysis's Initiative still exists
  // and is well-formed before any persistence, regardless of caller.
  const ancestry = await validateDirectInitiativeAncestry(
    { initiativeId: analysis.initiativeId },
    {
      initiativeExists(id) {
        resolvedInitiativeBox.value = deps.getInitiative(id);
        return resolvedInitiativeBox.value !== null;
      },
    },
  );

  // See module doc above: unreachable under the current contract, kept as
  // an explicit defensive invariant guard.
  if (ancestry.initiativeId !== analysis.initiativeId) {
    throw new Error(
      "Improvement proposal and its Collaborative Analysis belong to different Initiatives.",
    );
  }

  return { ancestry, analysis };
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

export async function createInitiativeImprovementProposalDraft(
  identity: RequestIdentity,
  input: CreateInitiativeImprovementProposalDraftInput,
  deps: InitiativeImprovementProposalAncestryDependencies = defaultInitiativeImprovementProposalAncestryDependencies,
): Promise<InitiativeImprovementProposal> {
  const { ancestry } = await assertEligibleAnalysisAndInitiativeAncestry(input.analysisId, deps);

  const now = new Date().toISOString();
  const proposalId = `initiative-proposal-${Date.now()}`;

  const proposal: InitiativeImprovementProposal = {
    proposalId,
    // Persisted initiativeId is sourced from the validated ancestry result,
    // not directly from the unchecked analysis.initiativeId field.
    initiativeId: ancestry.initiativeId,
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

  emitCivicNotificationEvent({
    eventType: "proposal_submitted",
    entityType: "improvement_proposal",
    entityId: proposalId,
    initiativeId: updated.initiativeId,
    actorMemberId: identity.participantId,
  });

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

  emitCivicNotificationEvent({
    eventType: "proposal_decided",
    entityType: "improvement_proposal",
    entityId: proposalId,
    initiativeId: updated.initiativeId,
    actorMemberId: identity.participantId,
  });

  return updated;
}
