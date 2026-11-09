import { randomUUID } from "node:crypto";

import type { Initiative } from "@hu/types";

import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { assertInitiativeOwnership } from "../initiatives/initiative-ownership.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import {
  createWorkingDraftInSlot,
  deleteWorkingDraftAndReleaseSlot,
} from "../initiative-petition-slots/petition-slot.service.js";
import {
  buildPetitionDraftTraceability,
  generatePetitionDraftContent,
} from "../initiative-petition-lifecycle/initiative-petition-draft-builder.js";
import { buildInitiativePetitionIntelligenceSnapshot } from "../initiative-petition-lifecycle/initiative-petition-intelligence.service.js";
import { resolveInitiativePetitionReference } from "../petition/initiative-petition-selection.js";
import {
  applyGeneratedPetitionWorkingDraft,
  findPetitionWorkingDraft,
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
    revisionId: null,
    revisionVersion: null,
    analysisId: null,
    analysisVersion: null,
    proposalIds: [],
    createdAt: now,
    updatedAt: now,
  };

  return createWorkingDraftInSlot(draft);
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

function hasAuthoredContent(draft: PetitionWorkingDraft): boolean {
  return (
    [
      draft.title,
      draft.publicSummary,
      draft.requestStatement,
      draft.expectedOutcome,
      draft.supportingContext,
    ].some((value) => value.trim().length > 0) || draft.keyArguments.length > 0
  );
}

/** Strictly later than `previous`, so a conditional write can always detect this one. */
function nextUpdatedAt(previous: string): string {
  const now = Date.now();
  const previousMs = Date.parse(previous);
  return new Date(Number.isNaN(previousMs) ? now : Math.max(now, previousMs + 1)).toISOString();
}

/**
 * HU-LC-05C.4B — generates Petition content into one selected draft from the
 * Initiative's Intelligence Snapshot (the same deterministic builder as the
 * legacy draft) and records the Revision / Analysis / Proposals it used.
 * Requires a Published Revision. Content that already exists is replaced only
 * with `overwrite: true`, and only if the draft is still exactly what was
 * inspected. Recipients, derivedFromPetitionId, identity fields and the draft's
 * slot are never touched; no draft, slot or Petition is created.
 */
export async function generatePetitionWorkingDraftContent(
  identity: RequestIdentity,
  initiativeId: string,
  draftId: string,
  options: { readonly overwrite: boolean },
): Promise<PetitionWorkingDraft> {
  getStewardedInitiative(initiativeId, identity);

  const draft = await findPetitionWorkingDraft(initiativeId, draftId);

  if (!draft) {
    throw new Error("Petition draft not found.");
  }

  const snapshot = await buildInitiativePetitionIntelligenceSnapshot(initiativeId);
  const traceability = buildPetitionDraftTraceability(snapshot);

  if (!traceability.revisionId || traceability.revisionVersion === null) {
    throw new Error(
      "Petition generation is not available until the Initiative has a Published Revision.",
    );
  }

  if (hasAuthoredContent(draft) && !options.overwrite) {
    throw new Error(
      "This Petition draft already has content; generate again with overwrite: true to replace it.",
    );
  }

  const generated = await generatePetitionDraftContent(snapshot);
  const updated = await applyGeneratedPetitionWorkingDraft(initiativeId, draftId, draft, {
    title: generated.title,
    publicSummary: generated.publicSummary,
    requestStatement: generated.requestStatement,
    expectedOutcome: generated.expectedOutcome,
    supportingContext: generated.supportingContext,
    keyArguments: [...generated.keyArguments],
    ...traceability,
    updatedAt: nextUpdatedAt(draft.updatedAt),
  });

  if (updated) {
    return updated;
  }

  if (!(await findPetitionWorkingDraft(initiativeId, draftId))) {
    throw new Error("Petition draft not found.");
  }

  throw new Error("The Petition draft was changed while generating; please retry.");
}

export async function deleteInitiativePetitionWorkingDraft(
  identity: RequestIdentity,
  initiativeId: string,
  draftId: string,
): Promise<void> {
  getStewardedInitiative(initiativeId, identity);

  if (!(await deleteWorkingDraftAndReleaseSlot(initiativeId, draftId))) {
    throw new Error("Petition draft not found.");
  }
}
