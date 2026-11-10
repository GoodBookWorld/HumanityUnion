import type { PublicPetitionProjection } from "@hu/types";

type ProjectionUpdate = (
  current: PublicPetitionProjection | null,
) => PublicPetitionProjection | null;

export interface PetitionSignatureRefreshDependencies {
  /** The public projection read (`getPublicPetition`). */
  readonly fetchProjection: (petitionId: string) => Promise<PublicPetitionProjection>;
  readonly applyProjection: (update: ProjectionUpdate) => void;
}

export interface PetitionSignatureRefresher {
  /** The Petition the view currently shows. */
  readonly showPetition: (petitionId: string) => void;
  /** After a successful Sign (true) or Withdraw (false) of `petitionId`. */
  readonly afterSignatureChange: (petitionId: string, viewerHasSigned: boolean) => Promise<void>;
}

/**
 * HU-LC-05C.4C.3A — after a successful sign or withdraw: shows the viewer's new
 * signature state at once, then replaces the projection with the server's, so
 * every support counter is the server's own count (never incremented locally).
 * A response for another Petition, or older than a later change, is ignored;
 * a failed refresh keeps the immediate state.
 */
export function createPetitionSignatureRefresher(
  dependencies: PetitionSignatureRefreshDependencies,
  initialPetitionId: string,
): PetitionSignatureRefresher {
  let shownPetitionId = initialPetitionId;
  let latestChange = 0;

  const forPetition =
    (petitionId: string, next: (current: PublicPetitionProjection) => PublicPetitionProjection) =>
    (current: PublicPetitionProjection | null) =>
      current && current.petitionIdentity.petitionId === petitionId ? next(current) : current;

  return {
    showPetition: (petitionId) => {
      shownPetitionId = petitionId;
    },
    afterSignatureChange: async (petitionId, viewerHasSigned) => {
      latestChange += 1;
      const change = latestChange;

      dependencies.applyProjection(
        forPetition(petitionId, (current) => ({ ...current, viewerHasSigned })),
      );

      let fresh: PublicPetitionProjection;
      try {
        fresh = await dependencies.fetchProjection(petitionId);
      } catch {
        return;
      }

      if (
        change !== latestChange ||
        shownPetitionId !== petitionId ||
        fresh.petitionIdentity.petitionId !== petitionId
      ) {
        return;
      }

      dependencies.applyProjection(forPetition(petitionId, () => fresh));
    },
  };
}
