import type {
  Initiative,
  InitiativeRevisionDraft,
  InitiativeRevisionDraftContext,
  InitiativeRevisionEligibleProposal,
  InitiativeVersionRevision,
} from "@hu/types";

import { getAnalysisById } from "../initiative-collaborative-analysis/initiative-collaborative-analysis.store.js";
import {
  getProposalById,
  listProposalsByInitiative,
  updateProposal,
} from "../initiative-improvement-proposal/initiative-improvement-proposal.store.js";
import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { assertInitiativeOwnership } from "../initiatives/initiative-ownership.js";
import { getInitiativeById, updateInitiative } from "../initiatives/initiative.store.js";
import { toLatestInitiativeCardProjection } from "../initiatives/initiative-latest-initiatives.projection.js";
import {
  removeProjectedInitiativeCard,
  upsertProjectedInitiativeCard,
} from "../initiatives/initiative-projection.store.js";
import { validateInitiativeForPublication } from "../initiatives/initiative.validators.js";
import {
  createRevision,
  deleteRevisionDraft,
  getCurrentPublishedVersion,
  getLatestRevisionForInitiative,
  getRevisionDraftByInitiativeId,
  listRevisionsByInitiative,
  updateRevisionDraft,
  upsertRevisionDraft,
} from "./initiative-version-revision.store.js";
import {
  type SaveInitiativeRevisionDraftInput,
  validateInitiativeRevisionDraftForPublication,
} from "./initiative-version-revision.validators.js";

function getOwnedInitiative(initiativeId: string, identity: RequestIdentity): Initiative {
  const initiative = getInitiativeById(initiativeId);

  if (!initiative) {
    throw new Error("Initiative not found.");
  }

  assertInitiativeOwnership(initiative, identity);

  return initiative;
}

function assertRevisionEligibleInitiative(initiative: Initiative): void {
  if (initiative.lifecyclePhase !== "published" && initiative.lifecyclePhase !== "projected") {
    throw new Error("Revisions can only be created for published or projected initiatives.");
  }
}

function listEligibleProposals(initiativeId: string): InitiativeRevisionEligibleProposal[] {
  return listProposalsByInitiative(initiativeId)
    .filter(
      (proposal) =>
        (proposal.status === "accepted" || proposal.status === "partially_accepted") &&
        proposal.implementedInVersion === undefined,
    )
    .map((proposal) => ({
      proposalId: proposal.proposalId,
      analysisId: proposal.analysisId,
      targetSection: proposal.targetSection,
      proposedChange: proposal.proposedChange,
      status: proposal.status as "accepted" | "partially_accepted",
    }));
}

function listDeclinedProposalIds(initiativeId: string): string[] {
  return listProposalsByInitiative(initiativeId)
    .filter((proposal) => proposal.status === "declined")
    .map((proposal) => proposal.proposalId);
}

function syncProjectedInitiativeCard(initiative: Initiative, previousCommunitySlug?: string): void {
  if (previousCommunitySlug && previousCommunitySlug !== initiative.metadata.communitySlug) {
    removeProjectedInitiativeCard(previousCommunitySlug, initiative.initiativeId);
  }

  if (initiative.lifecyclePhase !== "projected") {
    return;
  }

  const card = toLatestInitiativeCardProjection(initiative, 0);
  upsertProjectedInitiativeCard(initiative.metadata.communitySlug, card);
}

function partitionAppliedProposalIds(appliedProposalIds: string[]): {
  acceptedProposalIds: string[];
  partiallyAcceptedProposalIds: string[];
} {
  const acceptedProposalIds: string[] = [];
  const partiallyAcceptedProposalIds: string[] = [];

  for (const proposalId of appliedProposalIds) {
    const proposal = getProposalById(proposalId);

    if (!proposal) {
      throw new Error(`Proposal "${proposalId}" not found.`);
    }

    if (proposal.status === "accepted") {
      acceptedProposalIds.push(proposalId);
      continue;
    }

    if (proposal.status === "partially_accepted") {
      partiallyAcceptedProposalIds.push(proposalId);
      continue;
    }

    throw new Error(`Proposal "${proposalId}" is not eligible for implementation.`);
  }

  return { acceptedProposalIds, partiallyAcceptedProposalIds };
}

function validateAppliedProposalIds(initiativeId: string, appliedProposalIds: string[]): void {
  const eligibleIds = new Set(
    listEligibleProposals(initiativeId).map((proposal) => proposal.proposalId),
  );

  for (const proposalId of appliedProposalIds) {
    if (!eligibleIds.has(proposalId)) {
      throw new Error(`Proposal "${proposalId}" is not eligible for this revision.`);
    }
  }
}

export function listInitiativeVersionRevisions(
  identity: RequestIdentity,
  initiativeId: string,
): InitiativeVersionRevision[] {
  getOwnedInitiative(initiativeId, identity);

  return listRevisionsByInitiative(initiativeId);
}

export function getInitiativeRevisionWorkspaceContext(
  identity: RequestIdentity,
  initiativeId: string,
): InitiativeRevisionDraftContext {
  const initiative = getOwnedInitiative(initiativeId, identity);

  assertRevisionEligibleInitiative(initiative);

  return {
    draft: getRevisionDraftByInitiativeId(initiativeId),
    currentVersion: getCurrentPublishedVersion(initiativeId),
    eligibleProposals: listEligibleProposals(initiativeId),
    currentInitiative: {
      title: initiative.title,
      description: initiative.description,
      metadata: structuredClone(initiative.metadata),
    },
  };
}

export function createInitiativeRevisionDraft(
  identity: RequestIdentity,
  initiativeId: string,
): InitiativeRevisionDraft {
  const initiative = getOwnedInitiative(initiativeId, identity);

  assertRevisionEligibleInitiative(initiative);

  if (getCurrentPublishedVersion(initiativeId) === 0) {
    throw new Error("Initial version must be published before creating a revision.");
  }

  const now = new Date().toISOString();
  const draft: InitiativeRevisionDraft = {
    draftId: `initiative-revision-draft-${Date.now()}`,
    initiativeId,
    authorId: identity.participantId,
    title: initiative.title,
    description: initiative.description,
    metadata: structuredClone(initiative.metadata),
    revisionSummary: "",
    appliedProposalIds: [],
    skippedProposalIds: [],
    createdAt: now,
    updatedAt: now,
  };

  return upsertRevisionDraft(draft);
}

export function saveInitiativeRevisionDraft(
  identity: RequestIdentity,
  initiativeId: string,
  input: SaveInitiativeRevisionDraftInput,
): InitiativeRevisionDraft {
  getOwnedInitiative(initiativeId, identity);

  const existing = getRevisionDraftByInitiativeId(initiativeId);

  if (!existing) {
    throw new Error("Revision draft not found.");
  }

  if (input.appliedProposalIds !== undefined) {
    validateAppliedProposalIds(initiativeId, input.appliedProposalIds);
  }

  const updated = updateRevisionDraft(initiativeId, {
    title: input.title,
    description: input.description,
    metadata:
      input.communitySlug !== undefined || input.activityArea !== undefined
        ? {
            communitySlug: input.communitySlug,
            activityArea: input.activityArea,
            category: input.activityArea,
          }
        : undefined,
    revisionSummary: input.revisionSummary,
    appliedProposalIds: input.appliedProposalIds,
    skippedProposalIds: input.skippedProposalIds,
  });

  if (!updated) {
    throw new Error("Revision draft not found.");
  }

  return updated;
}

export function publishInitiativeRevision(
  identity: RequestIdentity,
  initiativeId: string,
): {
  revision: InitiativeVersionRevision;
  initiative: Initiative;
} {
  const initiative = getOwnedInitiative(initiativeId, identity);

  assertRevisionEligibleInitiative(initiative);

  const draft = getRevisionDraftByInitiativeId(initiativeId);

  if (!draft) {
    throw new Error("Revision draft not found.");
  }

  validateInitiativeRevisionDraftForPublication(draft);
  validateAppliedProposalIds(initiativeId, draft.appliedProposalIds);

  validateInitiativeForPublication({
    ...initiative,
    title: draft.title,
    description: draft.description,
    metadata: draft.metadata,
  });

  const currentVersion = getCurrentPublishedVersion(initiativeId);
  const nextVersion = currentVersion + 1;
  const publishedAt = new Date().toISOString();
  const { acceptedProposalIds, partiallyAcceptedProposalIds } = partitionAppliedProposalIds(
    draft.appliedProposalIds,
  );

  const revision: InitiativeVersionRevision = {
    revisionId: `initiative-version-revision-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    initiativeId,
    version: nextVersion,
    previousVersion: currentVersion > 0 ? currentVersion : null,
    authorId: identity.participantId,
    createdAt: publishedAt,
    publishedAt,
    revisionSummary: draft.revisionSummary,
    title: draft.title,
    description: draft.description,
    metadata: structuredClone(draft.metadata),
    acceptedProposalIds,
    partiallyAcceptedProposalIds,
    declinedProposalIds: listDeclinedProposalIds(initiativeId),
  };

  const previousCommunitySlug = initiative.metadata.communitySlug;
  const updatedInitiative = updateInitiative(initiativeId, {
    title: draft.title,
    description: draft.description,
    metadata: {
      communitySlug: draft.metadata.communitySlug,
      activityArea: draft.metadata.activityArea,
      category: draft.metadata.activityArea,
    },
    timeline: [
      ...initiative.timeline,
      {
        eventId: `timeline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        eventType: "initiative_revision_published",
        timestamp: publishedAt,
        metadata: {
          version: nextVersion,
          revisionId: revision.revisionId,
        },
      },
    ],
  });

  if (!updatedInitiative) {
    throw new Error("Initiative not found.");
  }

  const createdRevision = createRevision(revision);

  for (const proposalId of draft.appliedProposalIds) {
    updateProposal(proposalId, {
      implementedInRevisionId: createdRevision.revisionId,
      implementedInVersion: nextVersion,
    });
  }

  deleteRevisionDraft(initiativeId);
  syncProjectedInitiativeCard(updatedInitiative, previousCommunitySlug);

  return {
    revision: createdRevision,
    initiative: updatedInitiative,
  };
}

export function createInitialInitiativeVersionRevision(
  initiative: Initiative,
  authorId: string,
): InitiativeVersionRevision {
  const existing = getLatestRevisionForInitiative(initiative.initiativeId);

  if (existing) {
    return existing;
  }

  const publishedAt = new Date().toISOString();
  const revision: InitiativeVersionRevision = {
    revisionId: `initiative-version-revision-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    initiativeId: initiative.initiativeId,
    version: 1,
    previousVersion: null,
    authorId,
    createdAt: publishedAt,
    publishedAt,
    revisionSummary: "Initial published version.",
    title: initiative.title,
    description: initiative.description,
    metadata: structuredClone(initiative.metadata),
    acceptedProposalIds: [],
    partiallyAcceptedProposalIds: [],
    declinedProposalIds: listDeclinedProposalIds(initiative.initiativeId),
  };

  return createRevision(revision);
}

export function resolveInitiativeVersionForNewAnalysis(initiativeId: string): number {
  const currentVersion = getCurrentPublishedVersion(initiativeId);

  return currentVersion > 0 ? currentVersion : 1;
}

export function resolveAnalysisInitiativeVersion(analysisId: string): number {
  const analysis = getAnalysisById(analysisId);

  if (!analysis) {
    return 1;
  }

  return analysis.initiativeVersion ?? 1;
}
