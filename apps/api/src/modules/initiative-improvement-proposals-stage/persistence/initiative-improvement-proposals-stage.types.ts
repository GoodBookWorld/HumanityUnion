import type { InitiativeImprovementProposalsCollection } from "@hu/types";

export interface InitiativeImprovementProposalsStagePersistenceAdapter {
  readonly mode: "memory" | "file" | "mongodb";
  findById(collectionId: string): Promise<InitiativeImprovementProposalsCollection | null>;
  listByInitiativeAndAuthor(
    initiativeId: string,
    authorId: string,
  ): Promise<InitiativeImprovementProposalsCollection[]>;
  listByInitiative(initiativeId: string): Promise<InitiativeImprovementProposalsCollection[]>;
  insert(collection: InitiativeImprovementProposalsCollection): Promise<void>;
  update(collection: InitiativeImprovementProposalsCollection): Promise<void>;
  deleteByAuthorIdForTests(authorId: string): Promise<number>;
}
