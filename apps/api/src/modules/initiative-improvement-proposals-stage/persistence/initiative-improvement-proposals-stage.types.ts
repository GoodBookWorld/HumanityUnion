import type { InitiativeImprovementProposalsCollection } from "@hu/types";

export type PublishedImprovementProposalIdPage = {
  readonly proposalIds: readonly string[];
  readonly collectionsReturned: number;
  readonly hasMore: boolean;
};

export interface InitiativeImprovementProposalsStagePersistenceAdapter {
  readonly mode: "memory" | "file" | "mongodb";
  findById(collectionId: string): Promise<InitiativeImprovementProposalsCollection | null>;
  findPublishedProposalById(
    proposalId: string,
  ): Promise<{
    readonly collection: InitiativeImprovementProposalsCollection;
    readonly proposal: InitiativeImprovementProposalsCollection["proposals"][number];
  } | null>;
  listByInitiativeAndAuthor(
    initiativeId: string,
    authorId: string,
  ): Promise<InitiativeImprovementProposalsCollection[]>;
  listByInitiative(initiativeId: string): Promise<InitiativeImprovementProposalsCollection[]>;
  /**
   * Memory-bounded page of published collections → public proposal IDs only.
   * `offset` / `limit` apply to published collections, not proposals.
   */
  listPublishedProposalIdsPage(input: {
    readonly limit: number;
    readonly offset: number;
  }): Promise<PublishedImprovementProposalIdPage>;
  insert(collection: InitiativeImprovementProposalsCollection): Promise<void>;
  update(collection: InitiativeImprovementProposalsCollection): Promise<void>;
  deleteByAuthorIdForTests(authorId: string): Promise<number>;
}
