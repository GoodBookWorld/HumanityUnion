import { Router, type Request, type Response } from "express";

import { authenticationMiddleware } from "../auth/auth.middleware.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";
import {
  addCivicAccountabilityEvent,
  archiveCivicAccountability,
  closeCivicAccountability,
  getMyCivicAccountability,
  listMyCivicAccountabilities,
} from "./civic-accountability.service.js";

const civicAccountabilityRouter = Router();

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
  if (message.includes("not found")) {
    return 404;
  }

  if (message.includes("do not have access")) {
    return 403;
  }

  if (message.includes("cannot") || message.includes("Only active")) {
    return 409;
  }

  return 400;
}

function handleServiceError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "Civic accountability request failed.";
  res.status(resolveErrorStatus(message)).json(createFailureResponse(message));
}

function getAccountabilityId(req: Request): string {
  const accountabilityId = req.params.accountabilityId;
  return Array.isArray(accountabilityId) ? (accountabilityId[0] ?? "") : (accountabilityId ?? "");
}

civicAccountabilityRouter.get("/mine", authenticationMiddleware, (req, res) => {
  const identity = resolveRequestIdentity(req);
  const accountabilities = listMyCivicAccountabilities(identity);

  res.json(createSuccessResponse(accountabilities, "Civic accountability records loaded."));
});

civicAccountabilityRouter.get("/:accountabilityId", authenticationMiddleware, (req, res) => {
  const identity = resolveRequestIdentity(req);
  const detail = getMyCivicAccountability(identity, getAccountabilityId(req));

  if (!detail) {
    res.status(404).json(createFailureResponse("Civic accountability not found."));
    return;
  }

  res.json(createSuccessResponse(detail, "Civic accountability loaded."));
});

civicAccountabilityRouter.post(
  "/:accountabilityId/events",
  authenticationMiddleware,
  (req, res) => {
    try {
      const identity = resolveRequestIdentity(req);
      const result = addCivicAccountabilityEvent(identity, getAccountabilityId(req), req.body);

      res.status(201).json(createSuccessResponse(result, "Accountability event recorded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

civicAccountabilityRouter.post("/:accountabilityId/close", authenticationMiddleware, (req, res) => {
  try {
    const identity = resolveRequestIdentity(req);
    const accountability = closeCivicAccountability(identity, getAccountabilityId(req));

    res.json(createSuccessResponse(accountability, "Civic accountability closed."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

civicAccountabilityRouter.post(
  "/:accountabilityId/archive",
  authenticationMiddleware,
  (req, res) => {
    try {
      const identity = resolveRequestIdentity(req);
      const accountability = archiveCivicAccountability(identity, getAccountabilityId(req));

      res.json(createSuccessResponse(accountability, "Civic accountability archived."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

export default civicAccountabilityRouter;
