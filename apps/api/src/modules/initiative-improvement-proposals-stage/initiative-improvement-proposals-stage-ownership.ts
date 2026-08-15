import type { InitiativeImprovementProposalsCollection } from "@hu/types";

import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";

export function assertInitiativeImprovementProposalsCollectionOwnership(
  collection: InitiativeImprovementProposalsCollection,
  identity: RequestIdentity,
): void {
  if (collection.authorId !== identity.participantId) {
    throw new Error("You do not have access to this Improvement Proposals collection.");
  }
}
