import type { Request } from "express";
import type { Petition, PublicPetitionRecord } from "@hu/types";

import { isBootstrapAuthIdentity } from "../auth/auth.middleware.js";
import { requestIdentityFromAuth } from "../initiatives/identity/bootstrap-request-identity.js";
import { isInitiativeOwnedBy } from "../initiatives/initiative-ownership.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { canExposePublicInitiativeProjection } from "../initiatives/public-initiative.projection.js";
import { presentPetitionSubjectForParticipants } from "./petition-public-presentation.js";
import { isPetitionPubliclyVisible } from "./petition-public-visibility.js";

type PetitionAccessSubject = Pick<Petition, "status" | "subject">;

/**
 * HU-LC-05C.4C.6B — a Petition is publicly readable only when it has left
 * Draft/Ready and its Initiative passes the same ordinary-public check as the
 * Initiative experience. Missing, private, unprojected and administratively
 * blocked Initiatives therefore never expose their Petitions.
 * HU-LC-05C.4C.6C — the same gate applies before any signature mutation.
 */
export function isPetitionPubliclyReadable(petition: PetitionAccessSubject): boolean {
  return isPetitionPubliclyVisible(petition.status) && isPetitionInitiativePublic(petition);
}

export function isPetitionInitiativePublic(petition: Pick<Petition, "subject">): boolean {
  const initiative = getInitiativeById(petition.subject.initiativeId);
  return Boolean(initiative && canExposePublicInitiativeProjection(initiative));
}

/**
 * The verified steward of the Petition's Initiative may still read it while it
 * is unpublished or the Initiative is not public (same rule as Petition
 * management). The bootstrap identity never qualifies.
 */
export async function isPetitionStewardRequest(
  req: Request,
  petition: Pick<Petition, "subject">,
): Promise<boolean> {
  if (!req.auth?.memberId || isBootstrapAuthIdentity(req.auth)) {
    return false;
  }

  const initiative = getInitiativeById(petition.subject.initiativeId);
  return Boolean(
    initiative && isInitiativeOwnedBy(initiative, await requestIdentityFromAuth(req.auth)),
  );
}

export async function canReadPetition(
  req: Request,
  petition: PetitionAccessSubject,
): Promise<boolean> {
  return isPetitionPubliclyReadable(petition) || (await isPetitionStewardRequest(req, petition));
}

/**
 * Public-safe shape: no signatures (signer identities), only the public policy
 * parts, and participant-facing subject text (HU-LC-05C.4C.6L).
 */
export function toPublicPetitionRecord(petition: Petition): PublicPetitionRecord {
  const { signatures: _signatures, policy, ...rest } = structuredClone(petition);

  return {
    ...rest,
    subject: presentPetitionSubjectForParticipants(rest.subject),
    policy: {
      endorsementPeriod: policy.endorsementPeriod,
      withdrawalPolicy: policy.withdrawalPolicy,
    },
  };
}
