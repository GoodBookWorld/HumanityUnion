import { randomUUID } from "node:crypto";

import type { Initiative } from "@hu/types";

import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { assertInitiativeOwnership } from "../initiatives/initiative-ownership.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { resolveInitiativePetitionReference } from "../petition/initiative-petition-selection.js";
import {
  deletePetitionWorkingDraft,
  findPetitionWorkingDraft,
  insertPetitionWorkingDraft,
  listPetitionWorkingDrafts,
  updatePetitionWorkingDraft,
} from "./petition-working-draft.repository.js";
import type {
  PetitionWorkingDraft,
  PetitionWorkingDraftContentUpdate,
} from "./petition-working-draft.types.js";

/**
 * HU-LC-05C.3 — independent Petition drafts of a Standard Initiative. Every
 * operation requires stewardship of the Initiative named in the request, and a
 * draft is only ever addressed together with that Initiative.
 */
function getStewardedInitiative(initiativeId: string, identity: RequestIdentity): Initiative {
  const initiative = getInitiativeById(initiativeId);

  if (!initiative) {
    throw new Error("Initiative not found.");
  }

  assertInitiativeOwnership(initiative, identity);

  return initiative;
}

export async function createPetitionWorkingDraft(
  identity: RequestIdentity,
  initiativeId: string,
  input: { readonly derivedFromPetitionId?: string | null } = {},
): Promise<PetitionWorkingDraft> {
  getStewardedInitiative(initiativeId, identity);

  const derivedFromPetitionId = input.derivedFromPetitionId?.trim() || null;

  if (derivedFromPetitionId) {
    const reference = await resolveInitiativePetitionReference(initiativeId, derivedFromPetitionId);

    if (reference.kind !== "selected") {
      throw new Error("The Petition this draft derives from is not available for this Initiative.");
    }
  }

  const now = new Date().toISOString();
  const draft: PetitionWorkingDraft = {
    draftId: `initiative-petition-draft-${randomUUID()}`,
    initiativeId,
    authorId: identity.participantId,
    title: "",
    publicSummary: "",
    requestStatement: "",
    expectedOutcome: "",
    supportingContext: "",
    keyArguments: [],
    recipients: [],
    derivedFromPetitionId,
    createdAt: now,
    updatedAt: now,
  };

  await insertPetitionWorkingDraft(draft);

  return draft;
}

export async function listInitiativePetitionWorkingDrafts(
  identity: RequestIdentity,
  initiativeId: string,
): Promise<PetitionWorkingDraft[]> {
  getStewardedInitiative(initiativeId, identity);
  return listPetitionWorkingDrafts(initiativeId);
}

export async function getPetitionWorkingDraft(
  identity: RequestIdentity,
  initiativeId: string,
  draftId: string,
): Promise<PetitionWorkingDraft> {
  getStewardedInitiative(initiativeId, identity);

  const draft = await findPetitionWorkingDraft(initiativeId, draftId);

  if (!draft) {
    throw new Error("Petition draft not found.");
  }

  return draft;
}

export async function updatePetitionWorkingDraftContent(
  identity: RequestIdentity,
  initiativeId: string,
  draftId: string,
  update: PetitionWorkingDraftContentUpdate,
): Promise<PetitionWorkingDraft> {
  getStewardedInitiative(initiativeId, identity);

  const updated = await updatePetitionWorkingDraft(initiativeId, draftId, {
    ...update,
    updatedAt: new Date().toISOString(),
  });

  if (!updated) {
    throw new Error("Petition draft not found.");
  }

  return updated;
}

export async function deleteInitiativePetitionWorkingDraft(
  identity: RequestIdentity,
  initiativeId: string,
  draftId: string,
): Promise<void> {
  getStewardedInitiative(initiativeId, identity);

  if (!(await deletePetitionWorkingDraft(initiativeId, draftId))) {
    throw new Error("Petition draft not found.");
  }
}
