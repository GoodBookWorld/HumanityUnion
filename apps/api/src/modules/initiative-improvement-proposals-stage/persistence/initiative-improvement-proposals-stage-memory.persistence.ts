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
