import type { Request, Response } from "express";
import type { CollectiveDecision } from "@hu/types";

import { createSuccessResponse } from "../../shared/http-response.js";
import {
  mapCollectiveDecisionListResponse,
  mapCollectiveDecisionResponse,
  mapDecisionResultResponse,
  mapOutcomeResponse,
} from "./collective-decision.mapper.js";
import {
  archiveDecision,
  calculateDecisionResult,
  cancelDecision,
  closeDecision,
  completeDecision,
  createDecision,
  determineOutcome,
  getDecision,
  listDecisions,
  openDecision,
  scheduleDecision,
  submitParticipantDecision,
  updateDecision,
  type CollectiveDecisionUpdate,
} from "./collective-decision.store.js";
import {
  parseParticipantDecision,
  validateCreateDecision,
  validateDecisionId,
  validateParticipantDecisionBody,
  validatePatchBody,
  validateTimestampField,
} from "./collective-decision.validators.js";

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

function handleStoreError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "Collective Decision request failed.";
  res.status(400).json(createFailureResponse(message));
}

function getDecisionId(req: Request): string {
  const decisionId = req.params.decisionId;
  return Array.isArray(decisionId) ? (decisionId[0] ?? "") : (decisionId ?? "");
}

export function listCollectiveDecisionsHandler(_req: Request, res: Response): void {
  const decisions = listDecisions();

  res.json(
    createSuccessResponse(
      mapCollectiveDecisionListResponse(decisions),
      "Collective decisions loaded.",
    ),
  );
}

export function getCollectiveDecisionHandler(req: Request, res: Response): void {
  const decisionId = getDecisionId(req);
  const validationError = validateDecisionId(decisionId);

  if (validationError) {
    res.status(400).json(createFailureResponse(validationError));
    return;
  }

  const decision = getDecision(decisionId);

  if (!decision) {
    res.status(404).json(createFailureResponse("Collective Decision not found."));
    return;
  }

  res.json(
    createSuccessResponse(mapCollectiveDecisionResponse(decision), "Collective Decision loaded."),
  );
}

export function createCollectiveDecisionHandler(req: Request, res: Response): void {
  const decision = req.body as CollectiveDecision;
  const validationError = validateCreateDecision(decision);

  if (validationError) {
    res.status(400).json(createFailureResponse(validationError));
    return;
  }

  try {
    const created = createDecision(decision);

    res
      .status(201)
      .json(
        createSuccessResponse(
          mapCollectiveDecisionResponse(created),
          "Collective Decision created.",
        ),
      );
  } catch (error) {
    handleStoreError(res, error);
  }
}

export function patchCollectiveDecisionHandler(req: Request, res: Response): void {
  const decisionId = getDecisionId(req);
  const idError = validateDecisionId(decisionId);

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

  const update: CollectiveDecisionUpdate = {};

  if (body.ballot !== undefined) {
    update.ballot = body.ballot as CollectiveDecisionUpdate["ballot"];
  }

  try {
    const decision = updateDecision(decisionId, update);

    if (!decision) {
      res.status(404).json(createFailureResponse("Collective Decision not found."));
      return;
    }

    res.json(
      createSuccessResponse(
        mapCollectiveDecisionResponse(decision),
        "Collective Decision updated.",
      ),
    );
  } catch (error) {
    handleStoreError(res, error);
  }
}

export function submitParticipantDecisionHandler(req: Request, res: Response): void {
  const decisionId = getDecisionId(req);
  const idError = validateDecisionId(decisionId);

  if (idError) {
    res.status(400).json(createFailureResponse(idError));
    return;
  }

  const body = req.body as Record<string, unknown>;
  const validationError = validateParticipantDecisionBody(body);

  if (validationError) {
    res.status(400).json(createFailureResponse(validationError));
    return;
  }

  try {
    const decision = submitParticipantDecision(decisionId, parseParticipantDecision(body));

    if (!decision) {
      res.status(404).json(createFailureResponse("Collective Decision not found."));
      return;
    }

    res
      .status(201)
      .json(
        createSuccessResponse(
          mapCollectiveDecisionResponse(decision),
          "Participant Decision submitted.",
        ),
      );
  } catch (error) {
    handleStoreError(res, error);
  }
}

export function calculateDecisionResultHandler(req: Request, res: Response): void {
  const decisionId = getDecisionId(req);
  const idError = validateDecisionId(decisionId);

  if (idError) {
    res.status(400).json(createFailureResponse(idError));
    return;
  }

  try {
    const result = calculateDecisionResult(decisionId);

    if (!result) {
      res.status(404).json(createFailureResponse("Collective Decision not found."));
      return;
    }

    res.json(
      createSuccessResponse(mapDecisionResultResponse(result), "Decision Result calculated."),
    );
  } catch (error) {
    handleStoreError(res, error);
  }
}

export function determineOutcomeHandler(req: Request, res: Response): void {
  const decisionId = getDecisionId(req);
  const idError = validateDecisionId(decisionId);

  if (idError) {
    res.status(400).json(createFailureResponse(idError));
    return;
  }

  try {
    const outcome = determineOutcome(decisionId);

    if (!outcome) {
      res.status(404).json(createFailureResponse("Collective Decision not found."));
      return;
    }

    res.json(createSuccessResponse(mapOutcomeResponse(outcome), "Outcome determined."));
  } catch (error) {
    handleStoreError(res, error);
  }
}

export function scheduleDecisionHandler(req: Request, res: Response): void {
  const decisionId = getDecisionId(req);
  const idError = validateDecisionId(decisionId);

  if (idError) {
    res.status(400).json(createFailureResponse(idError));
    return;
  }

  const body = req.body as Record<string, unknown>;
  const timestampError = validateTimestampField(body, "scheduledAt");

  if (timestampError) {
    res.status(400).json(createFailureResponse(timestampError));
    return;
  }

  try {
    const decision = scheduleDecision(decisionId, body.scheduledAt as string);

    if (!decision) {
      res.status(404).json(createFailureResponse("Collective Decision not found."));
      return;
    }

    res.json(createSuccessResponse(mapCollectiveDecisionResponse(decision), "Decision scheduled."));
  } catch (error) {
    handleStoreError(res, error);
  }
}

export function openDecisionHandler(req: Request, res: Response): void {
  const decisionId = getDecisionId(req);
  const idError = validateDecisionId(decisionId);

  if (idError) {
    res.status(400).json(createFailureResponse(idError));
    return;
  }

  const body = req.body as Record<string, unknown>;
  const timestampError = validateTimestampField(body, "opensAt");

  if (timestampError) {
    res.status(400).json(createFailureResponse(timestampError));
    return;
  }

  try {
    const decision = openDecision(decisionId, body.opensAt as string);

    if (!decision) {
      res.status(404).json(createFailureResponse("Collective Decision not found."));
      return;
    }

    res.json(createSuccessResponse(mapCollectiveDecisionResponse(decision), "Decision opened."));
  } catch (error) {
    handleStoreError(res, error);
  }
}

export function closeDecisionHandler(req: Request, res: Response): void {
  const decisionId = getDecisionId(req);
  const idError = validateDecisionId(decisionId);

  if (idError) {
    res.status(400).json(createFailureResponse(idError));
    return;
  }

  const body = req.body as Record<string, unknown>;
  const timestampError = validateTimestampField(body, "closesAt");

  if (timestampError) {
    res.status(400).json(createFailureResponse(timestampError));
    return;
  }

  try {
    const decision = closeDecision(decisionId, body.closesAt as string);

    if (!decision) {
      res.status(404).json(createFailureResponse("Collective Decision not found."));
      return;
    }

    res.json(createSuccessResponse(mapCollectiveDecisionResponse(decision), "Decision closed."));
  } catch (error) {
    handleStoreError(res, error);
  }
}

export function completeDecisionHandler(req: Request, res: Response): void {
  const decisionId = getDecisionId(req);
  const idError = validateDecisionId(decisionId);

  if (idError) {
    res.status(400).json(createFailureResponse(idError));
    return;
  }

  try {
    const decision = completeDecision(decisionId);

    if (!decision) {
      res.status(404).json(createFailureResponse("Collective Decision not found."));
      return;
    }

    res.json(createSuccessResponse(mapCollectiveDecisionResponse(decision), "Decision completed."));
  } catch (error) {
    handleStoreError(res, error);
  }
}

export function archiveDecisionHandler(req: Request, res: Response): void {
  const decisionId = getDecisionId(req);
  const idError = validateDecisionId(decisionId);

  if (idError) {
    res.status(400).json(createFailureResponse(idError));
    return;
  }

  try {
    const decision = archiveDecision(decisionId);

    if (!decision) {
      res.status(404).json(createFailureResponse("Collective Decision not found."));
      return;
    }

    res.json(createSuccessResponse(mapCollectiveDecisionResponse(decision), "Decision archived."));
  } catch (error) {
    handleStoreError(res, error);
  }
}

export function cancelDecisionHandler(req: Request, res: Response): void {
  const decisionId = getDecisionId(req);
  const idError = validateDecisionId(decisionId);

  if (idError) {
    res.status(400).json(createFailureResponse(idError));
    return;
  }

  try {
    const decision = cancelDecision(decisionId);

    if (!decision) {
      res.status(404).json(createFailureResponse("Collective Decision not found."));
      return;
    }

    res.json(createSuccessResponse(mapCollectiveDecisionResponse(decision), "Decision cancelled."));
  } catch (error) {
    handleStoreError(res, error);
  }
}
