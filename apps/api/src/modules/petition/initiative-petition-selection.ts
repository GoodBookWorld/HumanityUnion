import type { Petition } from "@hu/types";

import { isPetitionPubliclyVisible } from "./petition-public-visibility.js";
import { getPetition, listPetitionsByInitiativeId } from "./petition.store.js";

/**
 * HU-LC-05C.1 — how a downstream Lifecycle stage picks the Petition it builds on.
 *
 * - A stored (or explicitly chosen) petitionId is authoritative. It resolves only
 *   when that Petition exists, belongs to the Initiative and is publicly visible;
 *   otherwise it is reported unavailable and never replaced by another Petition.
 * - Without a reference: no eligible Petition → none; exactly one → that one;
 *   several → an explicit selection is required.
 */
export type InitiativePetitionSelection =
  | { readonly kind: "selected"; readonly petition: Petition }
  | { readonly kind: "none" }
  | { readonly kind: "selection_required"; readonly candidatePetitionIds: readonly string[] }
  | { readonly kind: "reference_unavailable"; readonly petitionId: string };

/** Several eligible Petitions exist and the caller did not choose one. */
export class PetitionSelectionRequiredError extends Error {
  readonly code = "PETITION_SELECTION_REQUIRED";

  constructor(readonly candidatePetitionIds: readonly string[]) {
    super(
      `This Initiative has several published Petitions. Choose one by petitionId (${candidatePetitionIds.join(", ")}).`,
    );
    this.name = "PetitionSelectionRequiredError";
  }
}

/** A chosen Petition is missing, belongs to another Initiative, or is not public. */
export class PetitionReferenceUnavailableError extends Error {
  readonly code = "PETITION_REFERENCE_UNAVAILABLE";

  constructor(readonly petitionId: string) {
    super(`Petition "${petitionId}" is not available for this Initiative.`);
    this.name = "PetitionReferenceUnavailableError";
  }
}

/** HTTP status for Petition selection errors; null for any other error. */
export function petitionSelectionErrorStatus(error: unknown): number | null {
  return error instanceof PetitionSelectionRequiredError ||
    error instanceof PetitionReferenceUnavailableError
    ? 409
    : null;
}

/** Optional `petitionId` from a generate request body. */
export function parseOptionalPetitionId(body: unknown): string | null {
  const value = (body as { petitionId?: unknown } | null | undefined)?.petitionId;

  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string" || !value.trim()) {
    throw new Error("petitionId must be a non-empty string when provided.");
  }

  return value.trim();
}

/** Publicly visible Petitions of an Initiative, oldest first. */
export async function listEligibleInitiativePetitions(initiativeId: string): Promise<Petition[]> {
  return (await listPetitionsByInitiativeId(initiativeId)).filter((petition) =>
    isPetitionPubliclyVisible(petition.status),
  );
}

export async function resolveInitiativePetitionReference(
  initiativeId: string,
  petitionId: string,
): Promise<InitiativePetitionSelection> {
  const petition = await getPetition(petitionId);

  if (
    !petition ||
    petition.subject.initiativeId !== initiativeId ||
    !isPetitionPubliclyVisible(petition.status)
  ) {
    return { kind: "reference_unavailable", petitionId };
  }

  return { kind: "selected", petition };
}

export async function selectInitiativePetition(input: {
  readonly initiativeId: string;
  /** Stored or explicitly chosen reference; authoritative when present. */
  readonly petitionId?: string | null;
}): Promise<InitiativePetitionSelection> {
  const petitionId = input.petitionId?.trim();

  if (petitionId) {
    return resolveInitiativePetitionReference(input.initiativeId, petitionId);
  }

  const eligible = await listEligibleInitiativePetitions(input.initiativeId);

  if (eligible.length === 0) {
    return { kind: "none" };
  }

  if (eligible.length === 1) {
    return { kind: "selected", petition: eligible[0]! };
  }

  return {
    kind: "selection_required",
    candidatePetitionIds: eligible.map((petition) => petition.petitionId),
  };
}

/**
 * For stages that inherit their Petition from a published upstream record (e.g. the
 * Decision Session): that record's stored petitionId wins, and an empty one means no
 * Petition. Without an upstream record, only a sole eligible Petition is used.
 */
export async function selectInheritedInitiativePetition(input: {
  readonly initiativeId: string;
  readonly upstream: { readonly petitionId: string | null | undefined } | null;
}): Promise<InitiativePetitionSelection> {
  if (input.upstream) {
    const petitionId = input.upstream.petitionId?.trim();
    return petitionId
      ? resolveInitiativePetitionReference(input.initiativeId, petitionId)
      : { kind: "none" };
  }

  return selectInitiativePetition({ initiativeId: input.initiativeId });
}

/** Stored petitionId of a published Decision Session (Lifecycle traceability, else package). */
export function storedDecisionSessionPetitionId(session: {
  readonly traceability?: { readonly petitionId?: string | null } | null;
  readonly packageReferences?: { readonly petitionId?: string | null } | null;
}): string | null {
  return (
    session.traceability?.petitionId?.trim() ||
    session.packageReferences?.petitionId?.trim() ||
    null
  );
}

/** The selected Petition, or null for none / selection required / unavailable. */
export function selectedPetitionOrNull(selection: InitiativePetitionSelection): Petition | null {
  return selection.kind === "selected" ? selection.petition : null;
}

/**
 * Draft generation: an explicit or stored choice must resolve, and several eligible
 * Petitions without a choice are rejected instead of silently picking one.
 */
export function requireResolvedPetitionSelection(
  selection: InitiativePetitionSelection,
): Petition | null {
  switch (selection.kind) {
    case "selected":
      return selection.petition;
    case "none":
      return null;
    case "selection_required":
      throw new PetitionSelectionRequiredError(selection.candidatePetitionIds);
    case "reference_unavailable":
      throw new PetitionReferenceUnavailableError(selection.petitionId);
  }
}

/** Active signatures across all eligible Petitions (Initiative-level participation). */
export function countActiveSignatures(petitions: readonly Petition[]): number {
  return petitions.reduce(
    (total, petition) =>
      total + petition.signatures.filter((signature) => signature.status === "Active").length,
    0,
  );
}
