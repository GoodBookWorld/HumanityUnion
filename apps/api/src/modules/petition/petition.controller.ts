import type { Request, Response } from "express";
import type { Petition } from "@hu/types";

import { createSuccessResponse } from "../../shared/http-response.js";
import {
  InitiativeAncestryMissingError,
  InitiativeIdMalformedError,
  InitiativeNotFoundError,
} from "../../shared/initiative-ancestry/index.js";
import { AuthenticationRequiredError } from "../auth/auth.errors.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";
import { mapPetitionListResponse, mapPetitionResponse } from "./petition.mapper.js";
import {
  archivePetition,
  closePetition,
  createPetition,
  getPetition,
  getPetitionByCollectiveDecisionId,
  getPetitionByInitiativeId,
  listPetitions,
  openPetition,
  preparePetition,
  publishPetition,
  signPetition,
  updatePetition,
  withdrawPetitionSignature,
} from "./petition.store.js";
import {
  parsePetitionUpdate,
  parseSignRequest,
  validateCreatePetition,
  validateOptionalTimestampField,
  validatePatchBody,
  validatePetitionId,
  validateSignBody,
} from "./petition.validators.js";

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

function resolveErrorStatus(message: string): number {
  if (message.includes("already signed") || message.includes("is not allowed")) {
    return 409;
  }

  if (message.includes("read-only")) {
    return 409;
  }

  if (message.includes("concurrently modified")) {
    return 409;
  }

  // Initiative Lifecycle — Part F, Section 8 (Withdraw Signature).
  if (message.includes("has not signed") || message.includes("does not permit signature withdrawal")) {
    return 409;
  }

  return 400;
}

function handleStoreError(res: Response, error: unknown): void {
  // Direct Initiative ancestry errors — Recovery Task 24 Part 6. Mapped the
  // same way other direct-Initiative artifacts map them (see
  // initiative-improvement-proposal.routes.ts) so a Petition created against
  // a nonexistent Initiative fails the same way other artifacts do.
  if (error instanceof InitiativeNotFoundError) {
    res.status(404).json(createFailureResponse("Initiative not found."));
    return;
  }

  if (error instanceof InitiativeAncestryMissingError || error instanceof InitiativeIdMalformedError) {
    res.status(400).json(createFailureResponse(error.message));
    return;
  }

  // Initiative Lifecycle — Part F, Section 7/8. Thrown by
  // `resolveRequestIdentity` when the body omits `participantId` and no
  // real/bootstrap identity could be resolved.
  if (error instanceof AuthenticationRequiredError) {
    res.status(401).json(createFailureResponse(error.message));
    return;
  }

  const message = error instanceof Error ? error.message : "Petition request failed.";
  res.status(resolveErrorStatus(message)).json(createFailureResponse(message));
}

function getPetitionId(req: Request): string {
  const petitionId = req.params.petitionId;
  return Array.isArray(petitionId) ? (petitionId[0] ?? "") : (petitionId ?? "");
}

export async function listPetitionsHandler(_req: Request, res: Response): Promise<void> {
  const petitions = await listPetitions();

  res.json(createSuccessResponse(mapPetitionListResponse(petitions), "Petitions loaded."));
}

export async function getPetitionHandler(req: Request, res: Response): Promise<void> {
  const petitionId = getPetitionId(req);
  const validationError = validatePetitionId(petitionId);

  if (validationError) {
    res.status(400).json(createFailureResponse(validationError));
    return;
  }

  const petition = await getPetition(petitionId);

  if (!petition) {
    res.status(404).json(createFailureResponse("Petition not found."));
    return;
  }

  res.json(createSuccessResponse(mapPetitionResponse(petition), "Petition loaded."));
}

export async function getPetitionByCollectiveDecisionHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const collectiveDecisionId = Array.isArray(req.params.collectiveDecisionId)
    ? req.params.collectiveDecisionId[0]
    : req.params.collectiveDecisionId;

  if (!collectiveDecisionId?.trim()) {
    res.status(400).json(createFailureResponse("Collective Decision identifier is required."));
    return;
  }

  const petition = await getPetitionByCollectiveDecisionId(collectiveDecisionId);

  if (!petition) {
    res.status(404).json(createFailureResponse("Petition not found."));
    return;
  }

  res.json(createSuccessResponse(mapPetitionResponse(petition), "Petition loaded."));
}

export async function getPetitionByInitiativeHandler(req: Request, res: Response): Promise<void> {
  const initiativeId = Array.isArray(req.params.initiativeId)
    ? req.params.initiativeId[0]
    : req.params.initiativeId;

  if (!initiativeId?.trim()) {
    res.status(400).json(createFailureResponse("Initiative identifier is required."));
    return;
  }

  const petition = await getPetitionByInitiativeId(initiativeId);

  if (!petition) {
    res.status(404).json(createFailureResponse("Petition not found."));
    return;
  }

  res.json(createSuccessResponse(mapPetitionResponse(petition), "Petition loaded."));
}

export async function createPetitionHandler(req: Request, res: Response): Promise<void> {
  const petition = req.body as Petition;
  const validationError = validateCreatePetition(petition);

  if (validationError) {
    res.status(400).json(createFailureResponse(validationError));
    return;
  }

  try {
    const created = await createPetition(petition);

    res.status(201).json(createSuccessResponse(mapPetitionResponse(created), "Petition created."));
  } catch (error) {
    handleStoreError(res, error);
  }
}

export async function patchPetitionHandler(req: Request, res: Response): Promise<void> {
  const petitionId = getPetitionId(req);
  const idError = validatePetitionId(petitionId);

  if (idError) {
    res.status(400).json(createFailureResponse(idError));
    return;
  }

  const body = req.body as Record<string, unknown>;
  const patchError = validatePatchBody(body);

  if (patchError) {
    res.status(400).json(createFailureResponse(patchError));
    return;
  }

  try {
    const petition = await updatePetition(petitionId, parsePetitionUpdate(body));

    if (!petition) {
      res.status(404).json(createFailureResponse("Petition not found."));
      return;
    }

    res.json(createSuccessResponse(mapPetitionResponse(petition), "Petition updated."));
  } catch (error) {
    handleStoreError(res, error);
  }
}

export async function preparePetitionHandler(req: Request, res: Response): Promise<void> {
  const petitionId = getPetitionId(req);
  const idError = validatePetitionId(petitionId);

  if (idError) {
    res.status(400).json(createFailureResponse(idError));
    return;
  }

  try {
    const petition = await preparePetition(petitionId);

    if (!petition) {
      res.status(404).json(createFailureResponse("Petition not found."));
      return;
    }

    res.json(createSuccessResponse(mapPetitionResponse(petition), "Petition prepared."));
  } catch (error) {
    handleStoreError(res, error);
  }
}

export async function publishPetitionHandler(req: Request, res: Response): Promise<void> {
  const petitionId = getPetitionId(req);
  const idError = validatePetitionId(petitionId);

  if (idError) {
    res.status(400).json(createFailureResponse(idError));
    return;
  }

  try {
    const petition = await publishPetition(petitionId);

    if (!petition) {
      res.status(404).json(createFailureResponse("Petition not found."));
      return;
    }

    res.json(createSuccessResponse(mapPetitionResponse(petition), "Petition published."));
  } catch (error) {
    handleStoreError(res, error);
  }
}

export async function openPetitionHandler(req: Request, res: Response): Promise<void> {
  const petitionId = getPetitionId(req);
  const idError = validatePetitionId(petitionId);

  if (idError) {
    res.status(400).json(createFailureResponse(idError));
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const timestampError = validateOptionalTimestampField(body, "opensAt");

  if (timestampError) {
    res.status(400).json(createFailureResponse(timestampError));
    return;
  }

  try {
    const opensAt = typeof body.opensAt === "string" ? body.opensAt : undefined;
    const petition = await openPetition(petitionId, opensAt);

    if (!petition) {
      res.status(404).json(createFailureResponse("Petition not found."));
      return;
    }

    res.json(createSuccessResponse(mapPetitionResponse(petition), "Petition opened."));
  } catch (error) {
    handleStoreError(res, error);
  }
}

/**
 * Initiative Lifecycle — Part F, Section 7/8 (Representative Signatures).
 * When the request body omits `participantId` (the new Lifecycle-based
 * public Petition renderer never sends one), the acting Participant is
 * resolved from the authenticated request instead — mirroring
 * `withdrawPetitionSignatureHandler` below. The legacy body-supplied
 * contract keeps working unchanged whenever a caller still provides one.
 */
export async function signPetitionHandler(req: Request, res: Response): Promise<void> {
  const petitionId = getPetitionId(req);
  const idError = validatePetitionId(petitionId);

  if (idError) {
    res.status(400).json(createFailureResponse(idError));
    return;
  }

  const body = req.body as Record<string, unknown>;
  const validationError = validateSignBody(body);

  if (validationError) {
    res.status(400).json(createFailureResponse(validationError));
    return;
  }

  try {
    const { participantId: bodyParticipantId, participationMode } = parseSignRequest(body);
    const participantId = bodyParticipantId ?? (await resolveRequestIdentity(req)).participantId;
    const petition = await signPetition(petitionId, participantId, participationMode);

    if (!petition) {
      res.status(404).json(createFailureResponse("Petition not found."));
      return;
    }

    res
      .status(201)
      .json(createSuccessResponse(mapPetitionResponse(petition), "Signature recorded."));
  } catch (error) {
    handleStoreError(res, error);
  }
}

/**
 * Initiative Lifecycle — Part F, Section 8 (Petition Reactions — "Withdraw
 * Signature"). Unlike the pre-existing `signPetitionHandler`, the acting
 * Participant is resolved server-side from the authenticated request
 * (`resolveRequestIdentity`), never trusted from the request body — this
 * is a brand-new capability, so it is built with proper actor resolution
 * from the start rather than inheriting the legacy body-supplied
 * `participantId` pattern.
 */
export async function withdrawPetitionSignatureHandler(req: Request, res: Response): Promise<void> {
  const petitionId = getPetitionId(req);
  const idError = validatePetitionId(petitionId);

  if (idError) {
    res.status(400).json(createFailureResponse(idError));
    return;
  }

  try {
    const identity = await resolveRequestIdentity(req);
    const petition = await withdrawPetitionSignature(petitionId, identity.participantId);

    if (!petition) {
      res.status(404).json(createFailureResponse("Petition not found."));
      return;
    }

    res.json(createSuccessResponse(mapPetitionResponse(petition), "Signature withdrawn."));
  } catch (error) {
    handleStoreError(res, error);
  }
}

export async function closePetitionHandler(req: Request, res: Response): Promise<void> {
  const petitionId = getPetitionId(req);
  const idError = validatePetitionId(petitionId);

  if (idError) {
    res.status(400).json(createFailureResponse(idError));
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const timestampError = validateOptionalTimestampField(body, "closesAt");

  if (timestampError) {
    res.status(400).json(createFailureResponse(timestampError));
    return;
  }

  try {
    const closesAt = typeof body.closesAt === "string" ? body.closesAt : undefined;
    const petition = await closePetition(petitionId, closesAt);

    if (!petition) {
      res.status(404).json(createFailureResponse("Petition not found."));
      return;
    }

    res.json(createSuccessResponse(mapPetitionResponse(petition), "Petition closed."));
  } catch (error) {
    handleStoreError(res, error);
  }
}

export async function archivePetitionHandler(req: Request, res: Response): Promise<void> {
  const petitionId = getPetitionId(req);
  const idError = validatePetitionId(petitionId);

  if (idError) {
    res.status(400).json(createFailureResponse(idError));
    return;
  }

  try {
    const petition = await archivePetition(petitionId);

    if (!petition) {
      res.status(404).json(createFailureResponse("Petition not found."));
      return;
    }

    res.json(createSuccessResponse(mapPetitionResponse(petition), "Petition archived."));
  } catch (error) {
    handleStoreError(res, error);
  }
}
