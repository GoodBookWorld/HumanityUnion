import type { Request } from "express";

import { AuthenticationRequiredError } from "../auth/auth.errors.js";
import { isBootstrapAuthIdentity } from "../auth/auth.middleware.js";
import { requestIdentityFromAuth } from "../initiatives/identity/bootstrap-request-identity.js";
import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { isInitiativeOwnedBy } from "../initiatives/initiative-ownership.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { PetitionAccessDeniedError } from "./petition.errors.js";

/**
 * HU-LC-05B — actor for administrative Petition mutations: the Participant of a
 * verified access token. The bootstrap identity is never accepted here.
 */
export async function resolvePetitionMutationActor(req: Request): Promise<RequestIdentity> {
  if (!req.auth?.memberId || isBootstrapAuthIdentity(req.auth)) {
    throw new AuthenticationRequiredError();
  }

  return requestIdentityFromAuth(req.auth);
}

/**
 * A Petition belongs to its Initiative; only that Initiative's steward manages it.
 * A missing Initiative fails closed.
 */
export function assertCanManageInitiativePetition(
  initiativeId: string,
  actor: RequestIdentity,
): void {
  const initiative = getInitiativeById(initiativeId);

  if (!initiative || !isInitiativeOwnedBy(initiative, actor)) {
    throw new PetitionAccessDeniedError();
  }
}

/** Signers act only as themselves; a body-supplied participantId must match. */
export function assertSignerIsActor(
  bodyParticipantId: string | undefined,
  actor: RequestIdentity,
): void {
  if (bodyParticipantId !== undefined && bodyParticipantId !== actor.participantId) {
    throw new PetitionAccessDeniedError("You can sign a Petition only as yourself.");
  }
}
