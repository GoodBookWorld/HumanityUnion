import type { Request, Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import {
  mapImplementationCommitmentLinks,
  mapImplementationCommitmentListResponse,
  mapImplementationCommitmentResponse,
} from "./implementation-commitment.mapper.js";
import {
  activateImplementationCommitment,
  addContributionItem,
  archiveImplementationCommitment,
  completeImplementationCommitment,
  createImplementationCommitment,
  getImplementationCommitment,
  getImplementationCommitmentByCollectiveDecisionId,
  getImplementationCommitmentByInitiativeId,
  getImplementationCommitmentByPetitionId,
  listImplementationCommitments,
  removeContributionItem,
  submitImplementationCommitment,
  updateContributionProfile,
  updateImplementationCommitment,
  withdrawCommitment,
  withdrawCommitmentPhase,
} from "./implementation-commitment.store.js";
import {
  parseAddContributionItemInput,
  parseContributionProfileUpdate,
  parseCreateInput,
  parsePatchUpdate,
  parseWithdrawContributionBody,
  validateAddContributionItemBody,
  validateCommitmentId,
  validateContributionItemId,
  validateContributionProfileBody,
  validateCreateBody,
  validatePatchBody,
  validateReferenceId,
  validateWithdrawContributionBody,
} from "./implementation-commitment.validators.js";

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
  if (
    message.includes("already exists") ||
    message.includes("already has an active") ||
    message.includes("is not allowed") ||
    message.includes("read-only")
  ) {
    return 409;
  }

  if (message.includes("not found") && message.includes("Participant")) {
    return 404;
  }

  return 400;
}

function handleStoreError(res: Response, error: unknown): void {
  const message =
    error instanceof Error ? error.message : "Implementation Commitment request failed.";
  res.status(resolveErrorStatus(message)).json(createFailureResponse(message));
}

function getCommitmentId(req: Request): string {
  const commitmentId = req.params.commitmentId;
  return Array.isArray(commitmentId) ? (commitmentId[0] ?? "") : (commitmentId ?? "");
}

function getItemId(req: Request): string {
  const itemId = req.params.itemId;
  return Array.isArray(itemId) ? (itemId[0] ?? "") : (itemId ?? "");
}

function respondWithCommitment(
  res: Response,
  commitment: ReturnType<typeof mapImplementationCommitmentResponse>,
  message: string,
  status = 200,
): void {
  res
    .status(status)
    .json(
      createSuccessResponse(commitment, message, {}, mapImplementationCommitmentLinks(commitment)),
    );
}

export function listImplementationCommitmentsHandler(_req: Request, res: Response): void {
  const commitments = mapImplementationCommitmentListResponse(listImplementationCommitments());

  res.json(createSuccessResponse(commitments, "Implementation Commitments loaded."));
}

export function getImplementationCommitmentHandler(req: Request, res: Response): void {
  const commitmentId = getCommitmentId(req);
  const validationError = validateCommitmentId(commitmentId);

  if (validationError) {
    res.status(400).json(createFailureResponse(validationError));
    return;
  }

  const commitment = getImplementationCommitment(commitmentId);

  if (!commitment) {
    res.status(404).json(createFailureResponse("Implementation Commitment not found."));
    return;
  }

  respondWithCommitment(
    res,
    mapImplementationCommitmentResponse(commitment),
    "Implementation Commitment loaded.",
  );
}

export function getImplementationCommitmentByCollectiveDecisionHandler(
  req: Request,
  res: Response,
): void {
  const decisionId = Array.isArray(req.params.decisionId)
    ? req.params.decisionId[0]
    : req.params.decisionId;
  const validationError = validateReferenceId(decisionId ?? "", "Collective Decision identifier");

  if (validationError) {
    res.status(400).json(createFailureResponse(validationError));
    return;
  }

  const commitment = getImplementationCommitmentByCollectiveDecisionId(decisionId!);

  if (!commitment) {
    res.status(404).json(createFailureResponse("Implementation Commitment not found."));
    return;
  }

  respondWithCommitment(
    res,
    mapImplementationCommitmentResponse(commitment),
    "Implementation Commitment loaded.",
  );
}

export function getImplementationCommitmentByInitiativeHandler(req: Request, res: Response): void {
  const initiativeId = Array.isArray(req.params.initiativeId)
    ? req.params.initiativeId[0]
    : req.params.initiativeId;
  const validationError = validateReferenceId(initiativeId ?? "", "Initiative identifier");

  if (validationError) {
    res.status(400).json(createFailureResponse(validationError));
    return;
  }

  const commitment = getImplementationCommitmentByInitiativeId(initiativeId!);

  if (!commitment) {
    res.status(404).json(createFailureResponse("Implementation Commitment not found."));
    return;
  }

  respondWithCommitment(
    res,
    mapImplementationCommitmentResponse(commitment),
    "Implementation Commitment loaded.",
  );
}

export function getImplementationCommitmentByPetitionHandler(req: Request, res: Response): void {
  const petitionId = Array.isArray(req.params.petitionId)
    ? req.params.petitionId[0]
    : req.params.petitionId;
  const validationError = validateReferenceId(petitionId ?? "", "Petition identifier");

  if (validationError) {
    res.status(400).json(createFailureResponse(validationError));
    return;
  }

  const commitment = getImplementationCommitmentByPetitionId(petitionId!);

  if (!commitment) {
    res.status(404).json(createFailureResponse("Implementation Commitment not found."));
    return;
  }

  respondWithCommitment(
    res,
    mapImplementationCommitmentResponse(commitment),
    "Implementation Commitment loaded.",
  );
}

export function createImplementationCommitmentHandler(req: Request, res: Response): void {
  const body = req.body as Record<string, unknown>;
  const validationError = validateCreateBody(body);

  if (validationError) {
    res.status(400).json(createFailureResponse(validationError));
    return;
  }

  try {
    const created = createImplementationCommitment(parseCreateInput(body));

    respondWithCommitment(
      res,
      mapImplementationCommitmentResponse(created),
      "Implementation Commitment created.",
      201,
    );
  } catch (error) {
    handleStoreError(res, error);
  }
}

export function patchImplementationCommitmentHandler(req: Request, res: Response): void {
  const commitmentId = getCommitmentId(req);
  const idError = validateCommitmentId(commitmentId);

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
    const commitment = updateImplementationCommitment(commitmentId, parsePatchUpdate(body));

    if (!commitment) {
      res.status(404).json(createFailureResponse("Implementation Commitment not found."));
      return;
    }

    respondWithCommitment(
      res,
      mapImplementationCommitmentResponse(commitment),
      "Implementation Commitment updated.",
    );
  } catch (error) {
    handleStoreError(res, error);
  }
}

export function submitImplementationCommitmentHandler(req: Request, res: Response): void {
  const commitmentId = getCommitmentId(req);
  const idError = validateCommitmentId(commitmentId);

  if (idError) {
    res.status(400).json(createFailureResponse(idError));
    return;
  }

  try {
    const commitment = submitImplementationCommitment(commitmentId);

    if (!commitment) {
      res.status(404).json(createFailureResponse("Implementation Commitment not found."));
      return;
    }

    respondWithCommitment(
      res,
      mapImplementationCommitmentResponse(commitment),
      "Implementation Commitment submitted.",
    );
  } catch (error) {
    handleStoreError(res, error);
  }
}

export function activateImplementationCommitmentHandler(req: Request, res: Response): void {
  const commitmentId = getCommitmentId(req);
  const idError = validateCommitmentId(commitmentId);

  if (idError) {
    res.status(400).json(createFailureResponse(idError));
    return;
  }

  try {
    const commitment = activateImplementationCommitment(commitmentId);

    if (!commitment) {
      res.status(404).json(createFailureResponse("Implementation Commitment not found."));
      return;
    }

    respondWithCommitment(
      res,
      mapImplementationCommitmentResponse(commitment),
      "Implementation Commitment activated.",
    );
  } catch (error) {
    handleStoreError(res, error);
  }
}

export function updateContributionProfileHandler(req: Request, res: Response): void {
  const commitmentId = getCommitmentId(req);
  const idError = validateCommitmentId(commitmentId);

  if (idError) {
    res.status(400).json(createFailureResponse(idError));
    return;
  }

  const body = req.body as Record<string, unknown>;
  const validationError = validateContributionProfileBody(body);

  if (validationError) {
    res.status(400).json(createFailureResponse(validationError));
    return;
  }

  try {
    const { participantId, update } = parseContributionProfileUpdate(body);
    const commitment = updateContributionProfile(commitmentId, participantId, update);

    if (!commitment) {
      res.status(404).json(createFailureResponse("Implementation Commitment not found."));
      return;
    }

    respondWithCommitment(
      res,
      mapImplementationCommitmentResponse(commitment),
      "Contribution Profile updated.",
    );
  } catch (error) {
    handleStoreError(res, error);
  }
}

export function addContributionItemHandler(req: Request, res: Response): void {
  const commitmentId = getCommitmentId(req);
  const idError = validateCommitmentId(commitmentId);

  if (idError) {
    res.status(400).json(createFailureResponse(idError));
    return;
  }

  const body = req.body as Record<string, unknown>;
  const validationError = validateAddContributionItemBody(body);

  if (validationError) {
    res.status(400).json(createFailureResponse(validationError));
    return;
  }

  try {
    const commitment = addContributionItem(commitmentId, parseAddContributionItemInput(body));

    if (!commitment) {
      res.status(404).json(createFailureResponse("Implementation Commitment not found."));
      return;
    }

    respondWithCommitment(
      res,
      mapImplementationCommitmentResponse(commitment),
      "Contribution Item recorded.",
      201,
    );
  } catch (error) {
    handleStoreError(res, error);
  }
}

export function removeContributionItemHandler(req: Request, res: Response): void {
  const commitmentId = getCommitmentId(req);
  const itemId = getItemId(req);
  const idError = validateCommitmentId(commitmentId);

  if (idError) {
    res.status(400).json(createFailureResponse(idError));
    return;
  }

  const itemError = validateContributionItemId(itemId);

  if (itemError) {
    res.status(400).json(createFailureResponse(itemError));
    return;
  }

  try {
    const commitment = removeContributionItem(commitmentId, itemId);

    if (!commitment) {
      res.status(404).json(createFailureResponse("Implementation Commitment not found."));
      return;
    }

    respondWithCommitment(
      res,
      mapImplementationCommitmentResponse(commitment),
      "Contribution Item removed.",
    );
  } catch (error) {
    handleStoreError(res, error);
  }
}

export function withdrawContributionItemHandler(req: Request, res: Response): void {
  const commitmentId = getCommitmentId(req);
  const itemId = getItemId(req);
  const idError = validateCommitmentId(commitmentId);

  if (idError) {
    res.status(400).json(createFailureResponse(idError));
    return;
  }

  const itemError = validateContributionItemId(itemId);

  if (itemError) {
    res.status(400).json(createFailureResponse(itemError));
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const validationError = validateWithdrawContributionBody(body);

  if (validationError) {
    res.status(400).json(createFailureResponse(validationError));
    return;
  }

  try {
    const { participantId } = parseWithdrawContributionBody(body);
    const commitment = withdrawCommitment(commitmentId, itemId, participantId);

    if (!commitment) {
      res.status(404).json(createFailureResponse("Implementation Commitment not found."));
      return;
    }

    respondWithCommitment(
      res,
      mapImplementationCommitmentResponse(commitment),
      "Contribution Item withdrawn.",
    );
  } catch (error) {
    handleStoreError(res, error);
  }
}

export function withdrawImplementationCommitmentHandler(req: Request, res: Response): void {
  const commitmentId = getCommitmentId(req);
  const idError = validateCommitmentId(commitmentId);

  if (idError) {
    res.status(400).json(createFailureResponse(idError));
    return;
  }

  try {
    const commitment = withdrawCommitmentPhase(commitmentId);

    if (!commitment) {
      res.status(404).json(createFailureResponse("Implementation Commitment not found."));
      return;
    }

    respondWithCommitment(
      res,
      mapImplementationCommitmentResponse(commitment),
      "Implementation Commitment withdrawn.",
    );
  } catch (error) {
    handleStoreError(res, error);
  }
}

export function completeImplementationCommitmentHandler(req: Request, res: Response): void {
  const commitmentId = getCommitmentId(req);
  const idError = validateCommitmentId(commitmentId);

  if (idError) {
    res.status(400).json(createFailureResponse(idError));
    return;
  }

  try {
    const commitment = completeImplementationCommitment(commitmentId);

    if (!commitment) {
      res.status(404).json(createFailureResponse("Implementation Commitment not found."));
      return;
    }

    respondWithCommitment(
      res,
      mapImplementationCommitmentResponse(commitment),
      "Implementation Commitment completed.",
    );
  } catch (error) {
    handleStoreError(res, error);
  }
}

export function archiveImplementationCommitmentHandler(req: Request, res: Response): void {
  const commitmentId = getCommitmentId(req);
  const idError = validateCommitmentId(commitmentId);

  if (idError) {
    res.status(400).json(createFailureResponse(idError));
    return;
  }

  try {
    const commitment = archiveImplementationCommitment(commitmentId);

    if (!commitment) {
      res.status(404).json(createFailureResponse("Implementation Commitment not found."));
      return;
    }

    respondWithCommitment(
      res,
      mapImplementationCommitmentResponse(commitment),
      "Implementation Commitment archived.",
    );
  } catch (error) {
    handleStoreError(res, error);
  }
}
