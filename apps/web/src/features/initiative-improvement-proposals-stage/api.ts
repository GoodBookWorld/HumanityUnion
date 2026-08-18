import type {
  InitiativeImprovementProposalsCollection,
  InitiativeProposalIntelligenceSnapshot,
  InitiativeProposalReactionKind,
  InitiativeProposalReactionSummary,
  InitiativeStructuredProposalStatus,
  PublicInitiativeImprovementProposalsCollectionProjection,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export interface CreateManualInitiativeStructuredProposalInput {
  title: string;
  summary: string;
  description: string;
  reason: string;
  expectedImprovement: string;
  supportingSources?: string;
  relatedDiscussionReferences?: string;
}

export interface SaveInitiativeStructuredProposalInput {
  title?: string;
  summary?: string;
  description?: string;
  reason?: string;
  expectedImprovement?: string;
  supportingSources?: string;
  relatedDiscussionReferences?: string;
}

/**
 * Initiative Lifecycle — Part D. Resolves the ONE canonical Improvement
 * Proposals collection the Lifecycle Stage Workspace shows this Author for
 * this Initiative (in-progress draft first, otherwise latest published) —
 * mirrors `getMyCurrentInitiativeAnalysis` (Part B) exactly.
 */
export async function getMyCurrentImprovementProposalsCollection(
  initiativeId: string,
): Promise<InitiativeImprovementProposalsCollection | null> {
  return apiRequest<InitiativeImprovementProposalsCollection | null>(
    `/api/v1/improvement-proposal-collections/by-initiative/${encodeURIComponent(initiativeId)}/current`,
  );
}

/** Initiative Lifecycle — Part D, Section 2/3: the Automatic Proposal Collection + Proposal Intelligence Snapshot. */
export async function getInitiativeProposalIntelligenceSnapshot(
  initiativeId: string,
): Promise<InitiativeProposalIntelligenceSnapshot> {
  return apiRequest<InitiativeProposalIntelligenceSnapshot>(
    `/api/v1/improvement-proposal-collections/by-initiative/${encodeURIComponent(initiativeId)}/intelligence-snapshot`,
  );
}

/**
 * Initiative Lifecycle — Part D, Section 2/4: "Generate" enriches the
 * Author's current draft with any newly detected proposal groups — it
 * never overwrites an existing structured proposal's edited fields.
 */
export async function generateImprovementProposalsDraft(
  initiativeId: string,
): Promise<InitiativeImprovementProposalsCollection> {
  return apiRequest<InitiativeImprovementProposalsCollection>(
    `/api/v1/improvement-proposal-collections/by-initiative/${encodeURIComponent(initiativeId)}/generate`,
    { method: "POST" },
  );
}

export async function getImprovementProposalsCollectionById(
  collectionId: string,
): Promise<InitiativeImprovementProposalsCollection> {
  return apiRequest<InitiativeImprovementProposalsCollection>(
    `/api/v1/improvement-proposal-collections/${encodeURIComponent(collectionId)}`,
  );
}

export async function addManualInitiativeStructuredProposal(
  collectionId: string,
  input: CreateManualInitiativeStructuredProposalInput,
): Promise<InitiativeImprovementProposalsCollection> {
  return apiRequest<InitiativeImprovementProposalsCollection>(
    `/api/v1/improvement-proposal-collections/${encodeURIComponent(collectionId)}/proposals`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export async function saveInitiativeStructuredProposal(
  collectionId: string,
  proposalId: string,
  input: SaveInitiativeStructuredProposalInput,
): Promise<InitiativeImprovementProposalsCollection> {
  return apiRequest<InitiativeImprovementProposalsCollection>(
    `/api/v1/improvement-proposal-collections/${encodeURIComponent(collectionId)}/proposals/${encodeURIComponent(proposalId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export async function setInitiativeStructuredProposalStatus(
  collectionId: string,
  proposalId: string,
  status: InitiativeStructuredProposalStatus,
): Promise<InitiativeImprovementProposalsCollection> {
  return apiRequest<InitiativeImprovementProposalsCollection>(
    `/api/v1/improvement-proposal-collections/${encodeURIComponent(collectionId)}/proposals/${encodeURIComponent(proposalId)}/status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    },
  );
}

export async function publishImprovementProposalsCollection(
  collectionId: string,
): Promise<InitiativeImprovementProposalsCollection> {
  return apiRequest<InitiativeImprovementProposalsCollection>(
    `/api/v1/improvement-proposal-collections/${encodeURIComponent(collectionId)}/publish`,
    { method: "POST" },
  );
}

/** Open an empty draft collection (zero community proposals path). */
export async function ensureEmptyImprovementProposalsDraft(
  initiativeId: string,
): Promise<InitiativeImprovementProposalsCollection> {
  return apiRequest<InitiativeImprovementProposalsCollection>(
    `/api/v1/improvement-proposal-collections/by-initiative/${encodeURIComponent(initiativeId)}/ensure-empty-draft`,
    { method: "POST" },
  );
}

/**
 * Final Author completion: commit InitiativeVersionRevision + publish proposals
 * collection + unlock Petition.
 */
export async function completeImprovementProposalsWithVersionCommit(initiativeId: string): Promise<{
  collection: InitiativeImprovementProposalsCollection;
  revision: { revisionId: string; version: number };
  initiative: { initiativeId: string; title: string };
}> {
  return apiRequest(
    `/api/v1/improvement-proposal-collections/by-initiative/${encodeURIComponent(initiativeId)}/complete-with-version`,
    { method: "POST" },
  );
}

export async function archiveImprovementProposalsCollection(
  collectionId: string,
): Promise<InitiativeImprovementProposalsCollection> {
  return apiRequest<InitiativeImprovementProposalsCollection>(
    `/api/v1/improvement-proposal-collections/${encodeURIComponent(collectionId)}/archive`,
    { method: "POST" },
  );
}

export async function listPublicImprovementProposalsCollections(
  initiativeId: string,
): Promise<PublicInitiativeImprovementProposalsCollectionProjection[]> {
  return apiRequest<PublicInitiativeImprovementProposalsCollectionProjection[]>(
    `/api/v1/public/initiatives/${encodeURIComponent(initiativeId)}/improvement-proposal-collections`,
  );
}

export async function getPublicImprovementProposalsCollection(
  collectionId: string,
): Promise<PublicInitiativeImprovementProposalsCollectionProjection> {
  return apiRequest<PublicInitiativeImprovementProposalsCollectionProjection>(
    `/api/v1/public/improvement-proposal-collections/${encodeURIComponent(collectionId)}`,
  );
}

/**
 * Initiative Lifecycle — Part D, Section 9 (Community Reactions). `reaction`
 * of `"none"` clears the caller's existing reaction on this one proposal.
 */
export async function setInitiativeProposalReaction(
  collectionId: string,
  proposalId: string,
  reaction: InitiativeProposalReactionKind | "none",
): Promise<InitiativeProposalReactionSummary> {
  const result = await apiRequest<{
    reactionSummary: InitiativeProposalReactionSummary;
  }>(
    `/api/v1/public/improvement-proposal-collections/${encodeURIComponent(collectionId)}/proposals/${encodeURIComponent(proposalId)}/reactions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reaction }),
    },
  );

  return result.reactionSummary;
}
