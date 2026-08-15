import type { InitiativeImprovementProposalsCollection, InitiativeStructuredProposal } from "@hu/types";

import { resolveInitiativeImprovementProposalsStagePersistenceAdapter } from "./persistence/resolve-initiative-improvement-proposals-stage-persistence.js";

/**
 * Initiative Lifecycle — Part D. Mirrors
 * `initiative-collaborative-analysis.store.ts`'s shape (same
 * find/list/create/update surface), but delegates to an async
 * memory/mongo persistence adapter directly (Part D's collection is
 * always looked up by id or by initiative+author — no in-process Map
 * cache is needed the way Analysis's file-backed store needs one).
 */
export function getCollectionById(
  collectionId: string,
): Promise<InitiativeImprovementProposalsCollection | null> {
  return resolveInitiativeImprovementProposalsStagePersistenceAdapter().findById(collectionId);
}

export function listCollectionsByInitiativeAndAuthor(
  initiativeId: string,
  authorId: string,
): Promise<InitiativeImprovementProposalsCollection[]> {
  return resolveInitiativeImprovementProposalsStagePersistenceAdapter().listByInitiativeAndAuthor(
    initiativeId,
    authorId,
  );
}

export function listCollectionsByInitiative(
  initiativeId: string,
): Promise<InitiativeImprovementProposalsCollection[]> {
  return resolveInitiativeImprovementProposalsStagePersistenceAdapter().listByInitiative(initiativeId);
}

export async function listPublishedCollectionsByInitiative(
  initiativeId: string,
): Promise<InitiativeImprovementProposalsCollection[]> {
  const collections = await listCollectionsByInitiative(initiativeId);

  return collections
    .filter((collection) => collection.status === "published")
    .sort((left, right) => (right.publishedAt ?? "").localeCompare(left.publishedAt ?? ""));
}

export async function createCollection(
  collection: InitiativeImprovementProposalsCollection,
): Promise<InitiativeImprovementProposalsCollection> {
  await resolveInitiativeImprovementProposalsStagePersistenceAdapter().insert(collection);
  return structuredClone(collection);
}

export interface InitiativeImprovementProposalsCollectionUpdate {
  status?: InitiativeImprovementProposalsCollection["status"];
  proposals?: InitiativeStructuredProposal[];
  sourceSnapshotCreatedAt?: string | null;
  publishedAt?: string;
  analysisId?: string | null;
}

export async function updateCollection(
  collectionId: string,
  update: InitiativeImprovementProposalsCollectionUpdate,
): Promise<InitiativeImprovementProposalsCollection | null> {
  const adapter = resolveInitiativeImprovementProposalsStagePersistenceAdapter();
  const existing = await adapter.findById(collectionId);

  if (!existing) {
    return null;
  }

  const updated: InitiativeImprovementProposalsCollection = {
    ...existing,
    ...(update.status !== undefined ? { status: update.status } : {}),
    ...(update.proposals !== undefined ? { proposals: update.proposals } : {}),
    ...(update.sourceSnapshotCreatedAt !== undefined
      ? { sourceSnapshotCreatedAt: update.sourceSnapshotCreatedAt }
      : {}),
    ...(update.publishedAt !== undefined ? { publishedAt: update.publishedAt } : {}),
    ...(update.analysisId !== undefined ? { analysisId: update.analysisId } : {}),
    updatedAt: new Date().toISOString(),
  };

  await adapter.update(updated);

  return structuredClone(updated);
}

export function deleteCollectionsByAuthorIdForTests(authorId: string): Promise<number> {
  return resolveInitiativeImprovementProposalsStagePersistenceAdapter().deleteByAuthorIdForTests(authorId);
}
