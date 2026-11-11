import type { Request, Response } from "express";
import type { Petition } from "@hu/types";

import { createSuccessResponse } from "../../shared/http-response.js";
import { logger } from "../../shared/observability/logger.js";
import {
  InitiativeAncestryMissingError,
  InitiativeIdMalformedError,
  InitiativeNotFoundError,
} from "../../shared/initiative-ancestry/index.js";
import { AuthenticationRequiredError } from "../auth/auth.errors.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import {
  assertCanManageInitiativePetition,
  assertSignerIsActor,
  resolvePetitionMutationActor,
} from "./petition-mutation-authorization.js";
import {
  PetitionAccessDeniedError,
  PetitionConcurrencyConflictError,
  PetitionSignatureRejectedError,
  PetitionSlotRequiredError,
} from "./petition.errors.js";
import { findPetitionById } from "./persistence/petition.repository.js";
import {
  PetitionPublicationInProgressError,
  PetitionReservationLostError,
  PetitionSlotBusyError,
  PetitionSlotLimitError,
  publishPetitionWithinSlotLimit,
} from "../initiative-petition-slots/petition-slot.service.js";
import { listEligibleInitiativePetitions } from "./initiative-petition-selection.js";
import {
  canReadPetition,
  isPetitionPubliclyReadable,
  isPetitionStewardRequest,
  toPublicPetitionRecord,
} from "./petition-public-access.js";
import { mapPetitionResponse } from "./petition.mapper.js";
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

  if (error instanceof PetitionAccessDeniedError) {
    res.status(403).json(createFailureResponse(error.message));
    return;
  }

  if (
    error instanceof PetitionSlotLimitError ||
    error instanceof PetitionSlotBusyError ||
    error instanceof PetitionPublicationInProgressError ||
    error instanceof PetitionReservationLostError ||
    error instanceof PetitionSlotRequiredError
  ) {
    res.status(409).json(createFailureResponse(error.message));
    return;
  }

  const message = error instanceof Error ? error.message : "Petition request failed.";
  res.status(resolveErrorStatus(message)).json(createFailureResponse(message));
}

/**
 * HU-LC-05C.4C.6C — sign/withdraw failures. Expected refusals carry their own
 * identifier-free message; anything else is logged server-side and answered
 * with a generic message so internal details never reach the client.
 */
function handleSignatureError(
  res: Response,
  error: unknown,
  action: "sign" | "withdraw",
  petitionId: string,
): void {
  if (error instanceof PetitionSignatureRejectedError) {
    res
      .status(error.reason === "not_eligible" ? 403 : 409)
      .json(createFailureResponse(error.message));
    return;
  }

  if (error instanceof AuthenticationRequiredError) {
    res.status(401).json(createFailureResponse(error.message));
    return;
  }

  if (error instanceof PetitionAccessDeniedError) {
    res.status(403).json(createFailureResponse(error.message));
    return;
  }

  if (error instanceof PetitionConcurrencyConflictError) {
    res.status(409).json(createFailureResponse(error.message));
    return;
  }

  logger.error("petition.signature.request_failed", {
    action,
    petitionId,
    errorName: error instanceof Error ? error.name : typeof error,
    errorMessage: error instanceof Error ? error.message : String(error),
  });
  res
    .status(500)
    .json(
      createFailureResponse(
        action === "sign"
          ? "We could not record your signature. Please try again later."
          : "We could not withdraw your signature. Please try again later.",
      ),
    );
}

/**
 * HU-LC-05C.4C.6C — signatures change only on publicly readable Petitions (see
 * `isPetitionPubliclyReadable`, which applies `canExposePublicInitiativeProjection`).
 * Others get the read routes' 404; the steward, who can still see the
 * Petition, is told it is not open for signatures.
 */
async function guardPetitionSignature(
  req: Request,
  res: Response,
  petitionId: string,
): Promise<boolean> {
  const petition = await findPetitionById(petitionId);

  if (petition && isPetitionPubliclyReadable(petition)) {
    return true;
  }

  if (petition && (await isPetitionStewardRequest(req, petition))) {
    res.status(409).json(createFailureResponse("This Petition is not open for signatures."));
  } else {
    res.status(404).json(createFailureResponse("Petition not found."));
  }

  return false;
}

function getPetitionId(req: Request): string {
  const petitionId = req.params.petitionId;
  return Array.isArray(petitionId) ? (petitionId[0] ?? "") : (petitionId ?? "");
}

/**
 * HU-LC-05B — runs before any administrative mutation: authenticated actor, the
 * Petition exists, and the actor stewards its Initiative. Sends the failure response
 * and returns false otherwise.
 */
async function guardPetitionManagement(
  req: Request,
  res: Response,
  petitionId: string,
): Promise<boolean> {
  try {
    const actor = await resolvePetitionMutationActor(req);
    const petition = await getPetition(petitionId);

    if (!petition) {
      res.status(404).json(createFailureResponse("Petition not found."));
      return false;
    }

    assertCanManageInitiativePetition(petition.subject.initiativeId, actor);
    return true;
  } catch (error) {
    handleStoreError(res, error);
    return false;
  }
}

export async function listPetitionsHandler(_req: Request, res: Response): Promise<void> {
  const petitions = (await listPetitions()).filter(isPetitionPubliclyReadable);

  res.json(createSuccessResponse(petitions.map(toPublicPetitionRecord), "Petitions loaded."));
}

/** HU-LC-05C.4C.6B — legacy reads: only readable Petitions, always in the public-safe shape. */
async function sendReadablePetition(
  req: Request,
  res: Response,
  petition: Petition | null,
): Promise<void> {
  if (!petition || !(await canReadPetition(req, petition))) {
    res.status(404).json(createFailureResponse("Petition not found."));
    return;
  }

  res.json(createSuccessResponse(toPublicPetitionRecord(petition), "Petition loaded."));
}

export async function getPetitionHandler(req: Request, res: Response): Promise<void> {
  const petitionId = getPetitionId(req);
  const validationError = validatePetitionId(petitionId);

  if (validationError) {
    res.status(400).json(createFailureResponse(validationError));
    return;
  }

  await sendReadablePetition(req, res, await getPetition(petitionId));
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

  await sendReadablePetition(
    req,
    res,
    await getPetitionByCollectiveDecisionId(collectiveDecisionId),
  );
}

export async function getPetitionByInitiativeHandler(req: Request, res: Response): Promise<void> {
  const initiativeId = Array.isArray(req.params.initiativeId)
    ? req.params.initiativeId[0]
    : req.params.initiativeId;

  if (!initiativeId?.trim()) {
    res.status(400).json(createFailureResponse("Initiative identifier is required."));
    return;
  }

  // The steward keeps the existing "newest public, else newest" selection;
  // everyone else only ever gets the newest publicly readable Petition.
  const stewardPetition = await getPetitionByInitiativeId(initiativeId);

  if (stewardPetition && (await isPetitionStewardRequest(req, stewardPetition))) {
    await sendReadablePetition(req, res, stewardPetition);
    return;
  }

  const publicPetition =
    (await listEligibleInitiativePetitions(initiativeId))
      .filter(isPetitionPubliclyReadable)
      .at(-1) ?? null;
  await sendReadablePetition(req, res, publicPetition);
}

export async function createPetitionHandler(req: Request, res: Response): Promise<void> {
  const petition = req.body as Petition;
  const validationError = validateCreatePetition(petition);

  if (validationError) {
    res.status(400).json(createFailureResponse(validationError));
    return;
  }

  try {
    const actor = await resolvePetitionMutationActor(req);

    if (!getInitiativeById(petition.subject.initiativeId)) {
      res.status(404).json(createFailureResponse("Initiative not found."));
      return;
    }

    assertCanManageInitiativePetition(petition.subject.initiativeId, actor);
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

  if (!(await guardPetitionManagement(req, res, petitionId))) {
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

  if (!(await guardPetitionManagement(req, res, petitionId))) {
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

  if (!(await guardPetitionManagement(req, res, petitionId))) {
    return;
  }

  try {
    // HU-LC-05C.4A.3 — the shared Petition slot contract (three-slot limit).
    const petition = await publishPetitionWithinSlotLimit(petitionId);

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

  if (!(await guardPetitionManagement(req, res, petitionId))) {
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
 * The acting Participant is always resolved from the authenticated request —
 * mirroring `withdrawPetitionSignatureHandler` below. HU-LC-05B: a legacy
 * body-supplied `participantId` is accepted only when it is that same Participant.
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
    const actor = await resolveRequestIdentity(req);
    assertSignerIsActor(bodyParticipantId, actor);

    if (!(await guardPetitionSignature(req, res, petitionId))) {
      return;
    }

    const petition = await signPetition(petitionId, actor.participantId, participationMode);

    if (!petition) {
      res.status(404).json(createFailureResponse("Petition not found."));
      return;
    }

    res
      .status(201)
      .json(createSuccessResponse(toPublicPetitionRecord(petition), "Signature recorded."));
  } catch (error) {
    handleSignatureError(res, error, "sign", petitionId);
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

    if (!(await guardPetitionSignature(req, res, petitionId))) {
      return;
    }

    const petition = await withdrawPetitionSignature(petitionId, identity.participantId);

    if (!petition) {
      res.status(404).json(createFailureResponse("Petition not found."));
      return;
    }

    res.json(createSuccessResponse(toPublicPetitionRecord(petition), "Signature withdrawn."));
  } catch (error) {
    handleSignatureError(res, error, "withdraw", petitionId);
  }
}

export async function closePetitionHandler(req: Request, res: Response): Promise<void> {
  const petitionId = getPetitionId(req);
  const idError = validatePetitionId(petitionId);

  if (idError) {
    res.status(400).json(createFailureResponse(idError));
    return;
  }

  if (!(await guardPetitionManagement(req, res, petitionId))) {
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

  if (!(await guardPetitionManagement(req, res, petitionId))) {
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
