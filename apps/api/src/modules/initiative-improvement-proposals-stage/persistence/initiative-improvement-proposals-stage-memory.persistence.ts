import type { InitiativeImprovementProposalsCollection } from "@hu/types";

import type { InitiativeImprovementProposalsStagePersistenceAdapter } from "./initiative-improvement-proposals-stage.types.js";

export class MemoryInitiativeImprovementProposalsStagePersistenceAdapter
  implements InitiativeImprovementProposalsStagePersistenceAdapter
{
  readonly mode = "memory" as const;

  private collections = new Map<string, InitiativeImprovementProposalsCollection>();

  findById(collectionId: string): Promise<InitiativeImprovementProposalsCollection | null> {
    const collection = this.collections.get(collectionId);
    return Promise.resolve(collection ? structuredClone(collection) : null);
  }

  findPublishedProposalById(
    proposalId: string,
  ): Promise<{
    readonly collection: InitiativeImprovementProposalsCollection;
    readonly proposal: InitiativeImprovementProposalsCollection["proposals"][number];
  } | null> {
    for (const collection of this.collections.values()) {
      if (collection.status !== "published") {
        continue;
      }
      const proposal = collection.proposals.find((row) => row.proposalId === proposalId);
      if (
        proposal &&
        (proposal.status === "published" ||
          proposal.status === "included_in_revision" ||
          proposal.status === "keep_for_later" ||
          proposal.status === "not_applicable")
      ) {
        return Promise.resolve({
          collection: structuredClone(collection),
          proposal: structuredClone(proposal),
        });
      }
    }
    return Promise.resolve(null);
  }

  listByInitiativeAndAuthor(
    initiativeId: string,
    authorId: string,
  ): Promise<InitiativeImprovementProposalsCollection[]> {
    return Promise.resolve(
      [...this.collections.values()]
        .filter((collection) => collection.initiativeId === initiativeId && collection.authorId === authorId)
        .map((collection) => structuredClone(collection)),
    );
  }

  listByInitiative(initiativeId: string): Promise<InitiativeImprovementProposalsCollection[]> {
    return Promise.resolve(
      [...this.collections.values()]
        .filter((collection) => collection.initiativeId === initiativeId)
        .map((collection) => structuredClone(collection)),
    );
  }

  insert(collection: InitiativeImprovementProposalsCollection): Promise<void> {
    this.collections.set(collection.collectionId, structuredClone(collection));
    return Promise.resolve();
  }

  update(collection: InitiativeImprovementProposalsCollection): Promise<void> {
    this.collections.set(collection.collectionId, structuredClone(collection));
    return Promise.resolve();
  }

  deleteByAuthorIdForTests(authorId: string): Promise<number> {
    let deleted = 0;

    for (const [collectionId, collection] of this.collections.entries()) {
      if (collection.authorId === authorId) {
        this.collections.delete(collectionId);
        deleted += 1;
      }
    }

    return Promise.resolve(deleted);
  }

  clearForTests(): void {
    this.collections.clear();
  }
}

export function createMemoryInitiativeImprovementProposalsStagePersistenceAdapter(): MemoryInitiativeImprovementProposalsStagePersistenceAdapter {
  return new MemoryInitiativeImprovementProposalsStagePersistenceAdapter();
}
