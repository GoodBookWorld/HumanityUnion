import type {
  InitiativeImprovementProposalsCollection,
  InitiativeStructuredProposal,
  PublicInitiativeImprovementProposalsCollectionProjection,
  PublicInitiativeStructuredProposal,
} from "@hu/types";

import { getMemberById } from "../member/member-access.js";
import { getInitiativeProposalReactionSummary } from "../initiative-proposal-reactions/initiative-proposal-reaction.service.js";
import { getCollectionById, listPublishedCollectionsByInitiative } from "./initiative-improvement-proposals-stage.store.js";

async function resolveAuthorDisplayName(authorId: string): Promise<string> {
  const member = await getMemberById(authorId);

  return member?.profile.displayName ?? "Unknown Author";
}

/**
 * Part 8 — only proposals that have actually been published (or since
 * curated into one of the three post-publication statuses) are ever
 * shown publicly; a proposal still `"draft"`/`"ready"` inside an
 * otherwise-published collection is never exposed (that would leak
 * unfinished Author drafting into the public surface, violating Part 9's
 * "visitors never see editing controls or draft content").
 */
function isPubliclyVisible(proposal: InitiativeStructuredProposal): boolean {
  return proposal.status !== "draft" && proposal.status !== "ready";
}

async function toPublicStructuredProposal(
  proposal: InitiativeStructuredProposal,
  viewerUserId?: string | null,
): Promise<PublicInitiativeStructuredProposal> {
  const reactionSummary = await getInitiativeProposalReactionSummary({
    proposalId: proposal.proposalId,
    actorUserId: viewerUserId,
  });

  return {
    proposalId: proposal.proposalId,
    title: proposal.title,
    summary: proposal.summary,
    description: proposal.description,
    reason: proposal.reason,
    expectedImprovement: proposal.expectedImprovement,
    supportingSources: proposal.supportingSources,
    relatedDiscussionReferences: proposal.relatedDiscussionReferences,
    originalAuthorDisplayNames: proposal.originalAuthorDisplayNames,
    status: proposal.status,
    createdAt: proposal.createdAt,
    updatedAt: proposal.updatedAt,
    reactionSummary,
  };
}

export async function toPublicInitiativeImprovementProposalsCollectionProjection(
  collection: InitiativeImprovementProposalsCollection,
  viewerUserId?: string | null,
): Promise<PublicInitiativeImprovementProposalsCollectionProjection> {
  const [authorDisplayName, proposals] = await Promise.all([
    resolveAuthorDisplayName(collection.authorId),
    Promise.all(
      collection.proposals
        .filter(isPubliclyVisible)
        .map((proposal) => toPublicStructuredProposal(proposal, viewerUserId)),
    ),
  ]);

  return {
    collectionId: collection.collectionId,
    initiativeId: collection.initiativeId,
    authorDisplayName,
    publishedAt: collection.publishedAt ?? collection.updatedAt,
    version: 1,
    proposals,
  };
}

export async function getPublicInitiativeImprovementProposalsCollection(
  collectionId: string,
  viewerUserId?: string | null,
): Promise<PublicInitiativeImprovementProposalsCollectionProjection | null> {
  const collection = await getCollectionById(collectionId);

  if (!collection || collection.status !== "published") {
    return null;
  }

  return toPublicInitiativeImprovementProposalsCollectionProjection(collection, viewerUserId);
}

/**
 * Every published collection for this Initiative + Author, most recent
 * first, "version" numbered by publication order (1 = first ever
 * published, mirrors Collaborative Analysis's `publishedCount`
 * convention) — used by the public routes list endpoint and by the
 * Lifecycle adapter (Part 13).
 */
export async function listPublicInitiativeImprovementProposalsCollections(
  initiativeId: string,
  viewerUserId?: string | null,
): Promise<PublicInitiativeImprovementProposalsCollectionProjection[]> {
  const published = await listPublishedCollectionsByInitiative(initiativeId);
  const orderedOldestFirst = [...published].reverse();

  const projections = await Promise.all(
    orderedOldestFirst.map((collection) =>
      toPublicInitiativeImprovementProposalsCollectionProjection(collection, viewerUserId),
    ),
  );

  return projections
    .map((projection, index) => ({ ...projection, version: index + 1 }))
    .reverse();
}
