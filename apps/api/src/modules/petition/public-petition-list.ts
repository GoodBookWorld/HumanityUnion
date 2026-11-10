import type { PetitionState, PublicInitiativePetitionList } from "@hu/types";

import { listPetitionsByInitiativeId } from "./petition.store.js";
import { toPublicPetitionListItem } from "./public-petition.projection.js";

/** Same rule as signing (`signPetition`) and `participationEntryGuidance.signingAvailable`. */
export function isPetitionPubliclySignable(status: PetitionState): boolean {
  return status === "Open";
}

/**
 * HU-LC-05C.4C.3C — the Initiative's active, publicly signable Petitions in
 * the store's deterministic order (oldest first, ties by `petitionId`).
 * Working drafts live in a separate store and are never read here.
 */
export async function listPublicInitiativePetitions(
  initiativeId: string,
): Promise<PublicInitiativePetitionList> {
  const petitions = await listPetitionsByInitiativeId(initiativeId);

  return {
    initiativeId,
    petitions: petitions
      .filter(
        (petition) =>
          petition.subject.initiativeId === initiativeId &&
          isPetitionPubliclySignable(petition.status),
      )
      .map(toPublicPetitionListItem),
  };
}
