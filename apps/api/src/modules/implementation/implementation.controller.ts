import type { Request, Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import {
  mapImplementationLinks,
  mapImplementationListResponse,
  mapImplementationResponse,
} from "./implementation.mapper.js";
import {
  addMilestone,
  addPhase,
  archiveImplementation,
  attachEvidence,
  createImplementation,
  getImplementation,
  getImplementationByCollectiveDecisionId,
  getImplementationByCommitmentId,
  getImplementationByInitiativeId,
  getImplementationByPetitionId,
  listImplementations,
  recordAchievement,
  startImplementation,
  updateImplementation,
  updateMilestone,
  updatePhase,
} from "./implementation.store.js";
import {
  parseAddMilestoneInput,
  parseAddPhaseInput,
  parseAttachEvidenceInput,
  parseCreateInput,
  parsePatchUpdate,
  parseRecordAchievementInput,
  parseUpdateMilestoneInput,
  parseUpdatePhaseInput,
  validateAchievementId,
  validateAddMilestoneBody,
  validateAddPhaseBody,
  validateAttachEvidenceBody,
  validateCreateBody,
  validateImplementationId,
  validateMilestoneId,
  validatePatchBody,
  validatePhaseId,
  validateRecordAchievementBody,
  validateReferenceId,
  validateUpdateMilestoneBody,
  validateUpdatePhaseBody,
} from "./implementation.validators.js";

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
    message.includes("is not allowed") ||
    message.includes("read-only") ||
    message.includes("already satisfied")
  ) {
    return 409;
  }

  if (message.includes("not found") && message.includes("Participant")) {
    return 404;
  }

  return 400;
}

function handleStoreError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "Implementation request failed.";
  res.status(resolveErrorStatus(message)).json(createFailureResponse(message));
}

function getParam(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function respondWithImplementation(
  res: Response,
  implementation: ReturnType<typeof mapImplementationResponse>,
  message: string,
  status = 200,
): void {
  res
    .status(status)
    .json(
      createSuccessResponse(
        implementation,
        message,
        {},
        mapImplementationLinks(implementation),
      ),
    );
}

export function listImplementationsHandler(_req: Request, res: Response): void {
  const implementations = mapImplementationListResponse(listImplementations());

  res.json(createSuccessResponse(implementations, "Implementations loaded."));
}

export function getImplementationHandler(req: Request, res: Response): void {
  const implementationId = getParam(req, "implementationId");
  const validationError = validateImplementationId(implementationId);

  if (validationError) {
    res.status(400).json(createFailureResponse(validationError));
    return;
  }

  const implementation = getImplementation(implementationId);

  if (!implementation) {
    res.status(404).json(createFailureResponse("Implementation not found."));
    return;
  }

  respondWithImplementation(
    res,
    mapImplementationResponse(implementation),
    "Implementation loaded.",
  );
}

export function getImplementationByInitiativeHandler(req: Request, res: Response): void {
  const initiativeId = getParam(req, "initiativeId");
  const validationError = validateReferenceId(initiativeId, "Initiative identifier");

  if (validationError) {
    res.status(400).json(createFailureResponse(validationError));
    return;
  }

  const implementation = getImplementationByInitiativeId(initiativeId);

  if (!implementation) {
    res.status(404).json(createFailureResponse("Implementation not found."));
    return;
  }

  respondWithImplementation(
    res,
    mapImplementationResponse(implementation),
    "Implementation loaded.",
  );
}

export function getImplementationByCollectiveDecisionHandler(req: Request, res: Response): void {
  const decisionId = getParam(req, "decisionId");
  const validationError = validateReferenceId(decisionId, "Collective Decision identifier");

  if (validationError) {
    res.status(400).json(createFailureResponse(validationError));
    return;
  }

  const implementation = getImplementationByCollectiveDecisionId(decisionId);

  if (!implementation) {
    res.status(404).json(createFailureResponse("Implementation not found."));
    return;
  }

  respondWithImplementation(
    res,
    mapImplementationResponse(implementation),
    "Implementation loaded.",
  );
}

export function getImplementationByPetitionHandler(req: Request, res: Response): void {
  const petitionId = getParam(req, "petitionId");
  const validationError = validateReferenceId(petitionId, "Petition identifier");

  if (validationError) {
    res.status(400).json(createFailureResponse(validationError));
    return;
  }

  const implementation = getImplementationByPetitionId(petitionId);

  if (!implementation) {
    res.status(404).json(createFailureResponse("Implementation not found."));
    return;
  }

  respondWithImplementation(
    res,
    mapImplementationResponse(implementation),
    "Implementation loaded.",
  );
}

export function getImplementationByCommitmentHandler(req: Request, res: Response): void {
  const commitmentId = getParam(req, "commitmentId");
  const validationError = validateReferenceId(
    commitmentId,
    "Implementation Commitment identifier",
  );

  if (validationError) {
    res.status(400).json(createFailureResponse(validationError));
    return;
  }

  const implementation = getImplementationByCommitmentId(commitmentId);

  if (!implementation) {
    res.status(404).json(createFailureResponse("Implementation not found."));
    return;
  }

  respondWithImplementation(
    res,
    mapImplementationResponse(implementation),
    "Implementation loaded.",
  );
}

export function createImplementationHandler(req: Request, res: Response): void {
  const body = req.body as Record<string, unknown>;
  const validationError = validateCreateBody(body);

  if (validationError) {
    res.status(400).json(createFailureResponse(validationError));
    return;
  }

  try {
    const created = createImplementation(parseCreateInput(body));

    respondWithImplementation(
      res,
      mapImplementationResponse(created),
      "Implementation created.",
      201,
    );
  } catch (error) {
    handleStoreError(res, error);
  }
}

export function patchImplementationHandler(req: Request, res: Response): void {
  const implementationId = getParam(req, "implementationId");
  const idError = validateImplementationId(implementationId);

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
    const implementation = updateImplementation(implementationId, parsePatchUpdate(body));

    if (!implementation) {
      res.status(404).json(createFailureResponse("Implementation not found."));
      return;
    }

    respondWithImplementation(
      res,
      mapImplementationResponse(implementation),
      "Implementation updated.",
    );
  } catch (error) {
    handleStoreError(res, error);
  }
}

export function startImplementationHandler(req: Request, res: Response): void {
  const implementationId = getParam(req, "implementationId");
  const idError = validateImplementationId(implementationId);

  if (idError) {
    res.status(400).json(createFailureResponse(idError));
    return;
  }

  try {
    const implementation = startImplementation(implementationId);

    if (!implementation) {
      res.status(404).json(createFailureResponse("Implementation not found."));
      return;
    }

    respondWithImplementation(
      res,
      mapImplementationResponse(implementation),
      "Implementation started.",
    );
  } catch (error) {
    handleStoreError(res, error);
  }
}

export function addPhaseHandler(req: Request, res: Response): void {
  const implementationId = getParam(req, "implementationId");
  const idError = validateImplementationId(implementationId);

  if (idError) {
    res.status(400).json(createFailureResponse(idError));
    return;
  }

  const body = req.body as Record<string, unknown>;
  const validationError = validateAddPhaseBody(body);

  if (validationError) {
    res.status(400).json(createFailureResponse(validationError));
    return;
  }

  try {
    const implementation = addPhase(implementationId, parseAddPhaseInput(body));

    if (!implementation) {
      res.status(404).json(createFailureResponse("Implementation not found."));
      return;
    }

    respondWithImplementation(
      res,
      mapImplementationResponse(implementation),
      "Implementation Phase added.",
      201,
    );
  } catch (error) {
    handleStoreError(res, error);
  }
}

export function updatePhaseHandler(req: Request, res: Response): void {
  const implementationId = getParam(req, "implementationId");
  const phaseId = getParam(req, "phaseId");
  const idError = validateImplementationId(implementationId);

  if (idError) {
    res.status(400).json(createFailureResponse(idError));
    return;
  }

  const phaseError = validatePhaseId(phaseId);

  if (phaseError) {
    res.status(400).json(createFailureResponse(phaseError));
    return;
  }

  const body = req.body as Record<string, unknown>;
  const validationError = validateUpdatePhaseBody(body);

  if (validationError) {
    res.status(400).json(createFailureResponse(validationError));
    return;
  }

  try {
    const implementation = updatePhase(implementationId, phaseId, parseUpdatePhaseInput(body));

    if (!implementation) {
      res.status(404).json(createFailureResponse("Implementation not found."));
      return;
    }

    respondWithImplementation(
      res,
      mapImplementationResponse(implementation),
      "Implementation Phase updated.",
    );
  } catch (error) {
    handleStoreError(res, error);
  }
}

export function addMilestoneHandler(req: Request, res: Response): void {
  const implementationId = getParam(req, "implementationId");
  const idError = validateImplementationId(implementationId);

  if (idError) {
    res.status(400).json(createFailureResponse(idError));
    return;
  }

  const body = req.body as Record<string, unknown>;
  const validationError = validateAddMilestoneBody(body);

  if (validationError) {
    res.status(400).json(createFailureResponse(validationError));
    return;
  }

  try {
    const implementation = addMilestone(implementationId, parseAddMilestoneInput(body));

    if (!implementation) {
      res.status(404).json(createFailureResponse("Implementation not found."));
      return;
    }

    respondWithImplementation(
      res,
      mapImplementationResponse(implementation),
      "Milestone added.",
      201,
    );
  } catch (error) {
    handleStoreError(res, error);
  }
}

export function updateMilestoneHandler(req: Request, res: Response): void {
  const implementationId = getParam(req, "implementationId");
  const milestoneId = getParam(req, "milestoneId");
  const idError = validateImplementationId(implementationId);

  if (idError) {
    res.status(400).json(createFailureResponse(idError));
    return;
  }

  const milestoneError = validateMilestoneId(milestoneId);

  if (milestoneError) {
    res.status(400).json(createFailureResponse(milestoneError));
    return;
  }

  const body = req.body as Record<string, unknown>;
  const validationError = validateUpdateMilestoneBody(body);

  if (validationError) {
    res.status(400).json(createFailureResponse(validationError));
    return;
  }

  try {
    const implementation = updateMilestone(
      implementationId,
      milestoneId,
      parseUpdateMilestoneInput(body),
    );

    if (!implementation) {
      res.status(404).json(createFailureResponse("Implementation not found."));
      return;
    }

    respondWithImplementation(
      res,
      mapImplementationResponse(implementation),
      "Milestone updated.",
    );
  } catch (error) {
    handleStoreError(res, error);
  }
}

export function recordAchievementHandler(req: Request, res: Response): void {
  const implementationId = getParam(req, "implementationId");
  const idError = validateImplementationId(implementationId);

  if (idError) {
    res.status(400).json(createFailureResponse(idError));
    return;
  }

  const body = req.body as Record<string, unknown>;
  const validationError = validateRecordAchievementBody(body);

  if (validationError) {
    res.status(400).json(createFailureResponse(validationError));
    return;
  }

  try {
    const implementation = recordAchievement(implementationId, parseRecordAchievementInput(body));

    if (!implementation) {
      res.status(404).json(createFailureResponse("Implementation not found."));
      return;
    }

    respondWithImplementation(
      res,
      mapImplementationResponse(implementation),
      "Achievement recorded.",
      201,
    );
  } catch (error) {
    handleStoreError(res, error);
  }
}

export function attachEvidenceHandler(req: Request, res: Response): void {
  const implementationId = getParam(req, "implementationId");
  const achievementId = getParam(req, "achievementId");
  const idError = validateImplementationId(implementationId);

  if (idError) {
    res.status(400).json(createFailureResponse(idError));
    return;
  }

  const achievementError = validateAchievementId(achievementId);

  if (achievementError) {
    res.status(400).json(createFailureResponse(achievementError));
    return;
  }

  const body = req.body as Record<string, unknown>;
  const validationError = validateAttachEvidenceBody(body);

  if (validationError) {
    res.status(400).json(createFailureResponse(validationError));
    return;
  }

  try {
    const implementation = attachEvidence(
      implementationId,
      parseAttachEvidenceInput(achievementId, body),
    );

    if (!implementation) {
      res.status(404).json(createFailureResponse("Implementation not found."));
      return;
    }

    respondWithImplementation(
      res,
      mapImplementationResponse(implementation),
      "Evidence attached.",
      201,
    );
  } catch (error) {
    handleStoreError(res, error);
  }
}

export function archiveImplementationHandler(req: Request, res: Response): void {
  const implementationId = getParam(req, "implementationId");
  const idError = validateImplementationId(implementationId);

  if (idError) {
    res.status(400).json(createFailureResponse(idError));
    return;
  }

  try {
    const implementation = archiveImplementation(implementationId);

    if (!implementation) {
      res.status(404).json(createFailureResponse("Implementation not found."));
      return;
    }

    respondWithImplementation(
      res,
      mapImplementationResponse(implementation),
      "Implementation archived.",
    );
  } catch (error) {
    handleStoreError(res, error);
  }
}
