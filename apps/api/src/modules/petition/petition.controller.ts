import type { Request, Response } from "express";
import type { Petition } from "@hu/types";

import { createSuccessResponse } from "../../shared/http-response.js";
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

  return 400;
}

function handleStoreError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "Petition request failed.";
  res.status(resolveErrorStatus(message)).json(createFailureResponse(message));
}

function getPetitionId(req: Request): string {
  const petitionId = req.params.petitionId;
  return Array.isArray(petitionId) ? (petitionId[0] ?? "") : (petitionId ?? "");
}

export function listPetitionsHandler(_req: Request, res: Response): void {
  const petitions = listPetitions();

  res.json(createSuccessResponse(mapPetitionListResponse(petitions), "Petitions loaded."));
}

export function getPetitionHandler(req: Request, res: Response): void {
  const petitionId = getPetitionId(req);
  const validationError = validatePetitionId(petitionId);

  if (validationError) {
    res.status(400).json(createFailureResponse(validationError));
    return;
  }

  const petition = getPetition(petitionId);

  if (!petition) {
    res.status(404).json(createFailureResponse("Petition not found."));
    return;
  }

  res.json(createSuccessResponse(mapPetitionResponse(petition), "Petition loaded."));
}

export function getPetitionByCollectiveDecisionHandler(req: Request, res: Response): void {
  const collectiveDecisionId = Array.isArray(req.params.collectiveDecisionId)
    ? req.params.collectiveDecisionId[0]
    : req.params.collectiveDecisionId;

  if (!collectiveDecisionId?.trim()) {
    res.status(400).json(createFailureResponse("Collective Decision identifier is required."));
    return;
  }

  const petition = getPetitionByCollectiveDecisionId(collectiveDecisionId);

  if (!petition) {
    res.status(404).json(createFailureResponse("Petition not found."));
    return;
  }

  res.json(createSuccessResponse(mapPetitionResponse(petition), "Petition loaded."));
}

export function getPetitionByInitiativeHandler(req: Request, res: Response): void {
  const initiativeId = Array.isArray(req.params.initiativeId)
    ? req.params.initiativeId[0]
    : req.params.initiativeId;

  if (!initiativeId?.trim()) {
    res.status(400).json(createFailureResponse("Initiative identifier is required."));
    return;
  }

  const petition = getPetitionByInitiativeId(initiativeId);

  if (!petition) {
    res.status(404).json(createFailureResponse("Petition not found."));
    return;
  }

  res.json(createSuccessResponse(mapPetitionResponse(petition), "Petition loaded."));
}

export function createPetitionHandler(req: Request, res: Response): void {
  const petition = req.body as Petition;
  const validationError = validateCreatePetition(petition);

  if (validationError) {
    res.status(400).json(createFailureResponse(validationError));
    return;
  }

  try {
    const created = createPetition(petition);

    res.status(201).json(createSuccessResponse(mapPetitionResponse(created), "Petition created."));
  } catch (error) {
    handleStoreError(res, error);
  }
}

export function patchPetitionHandler(req: Request, res: Response): void {
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
    const petition = updatePetition(petitionId, parsePetitionUpdate(body));

    if (!petition) {
      res.status(404).json(createFailureResponse("Petition not found."));
      return;
    }

    res.json(createSuccessResponse(mapPetitionResponse(petition), "Petition updated."));
  } catch (error) {
    handleStoreError(res, error);
  }
}

export function preparePetitionHandler(req: Request, res: Response): void {
  const petitionId = getPetitionId(req);
  const idError = validatePetitionId(petitionId);

  if (idError) {
    res.status(400).json(createFailureResponse(idError));
    return;
  }

  try {
    const petition = preparePetition(petitionId);

    if (!petition) {
      res.status(404).json(createFailureResponse("Petition not found."));
      return;
    }

    res.json(createSuccessResponse(mapPetitionResponse(petition), "Petition prepared."));
  } catch (error) {
    handleStoreError(res, error);
  }
}

export function publishPetitionHandler(req: Request, res: Response): void {
  const petitionId = getPetitionId(req);
  const idError = validatePetitionId(petitionId);

  if (idError) {
    res.status(400).json(createFailureResponse(idError));
    return;
  }

  try {
    const petition = publishPetition(petitionId);

    if (!petition) {
      res.status(404).json(createFailureResponse("Petition not found."));
      return;
    }

    res.json(createSuccessResponse(mapPetitionResponse(petition), "Petition published."));
  } catch (error) {
    handleStoreError(res, error);
  }
}

export function openPetitionHandler(req: Request, res: Response): void {
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
    const petition = openPetition(petitionId, opensAt);

    if (!petition) {
      res.status(404).json(createFailureResponse("Petition not found."));
      return;
    }

    res.json(createSuccessResponse(mapPetitionResponse(petition), "Petition opened."));
  } catch (error) {
    handleStoreError(res, error);
  }
}

export function signPetitionHandler(req: Request, res: Response): void {
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
    const { participantId, participationMode } = parseSignRequest(body);
    const petition = signPetition(petitionId, participantId, participationMode);

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

export function closePetitionHandler(req: Request, res: Response): void {
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
    const petition = closePetition(petitionId, closesAt);

    if (!petition) {
      res.status(404).json(createFailureResponse("Petition not found."));
      return;
    }

    res.json(createSuccessResponse(mapPetitionResponse(petition), "Petition closed."));
  } catch (error) {
    handleStoreError(res, error);
  }
}

export function archivePetitionHandler(req: Request, res: Response): void {
  const petitionId = getPetitionId(req);
  const idError = validatePetitionId(petitionId);

  if (idError) {
    res.status(400).json(createFailureResponse(idError));
    return;
  }

  try {
    const petition = archivePetition(petitionId);

    if (!petition) {
      res.status(404).json(createFailureResponse("Petition not found."));
      return;
    }

    res.json(createSuccessResponse(mapPetitionResponse(petition), "Petition archived."));
  } catch (error) {
    handleStoreError(res, error);
  }
}
