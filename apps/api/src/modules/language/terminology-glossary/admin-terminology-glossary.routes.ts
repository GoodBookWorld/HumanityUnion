import { Router, type Response } from "express";

import { createSuccessResponse } from "../../../shared/http-response.js";
import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
  AdministrationValidationError,
} from "../../administration/administration.errors.js";
import {
  authenticationMiddleware,
  requireAuthenticationMiddleware,
} from "../../auth/auth.middleware.js";
import {
  TerminologyGlossaryConflictError,
  TerminologyGlossaryNotFoundError,
  TerminologyGlossaryPersistenceError,
  TerminologyGlossaryValidationError,
} from "./terminology-glossary.errors.js";
import {
  getAdminTerminologyConcept,
  listAdminTerminologyConcepts,
  updateAdminTerminologyConcept,
} from "./admin-terminology-glossary.service.js";

const adminTerminologyGlossaryRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

function resolveErrorStatus(error: unknown): number {
  if (error instanceof AdministrationUnauthorizedError) {
    return 401;
  }
  if (error instanceof AdministrationForbiddenError) {
    return 403;
  }
  if (error instanceof TerminologyGlossaryNotFoundError) {
    return 404;
  }
  if (error instanceof TerminologyGlossaryConflictError) {
    return 409;
  }
  if (
    error instanceof TerminologyGlossaryValidationError ||
    error instanceof AdministrationValidationError
  ) {
    return 400;
  }
  if (error instanceof TerminologyGlossaryPersistenceError) {
    return 503;
  }
  return 500;
}

function handleError(res: Response, error: unknown): void {
  const message =
    error instanceof Error ? error.message : "Admin terminology glossary request failed.";
  res.status(resolveErrorStatus(error)).json(createFailureResponse(message));
}

adminTerminologyGlossaryRouter.get(
  "/",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const result = await listAdminTerminologyConcepts({
        actorUserId: req.auth!.id,
      });
      res.json(createSuccessResponse(result, "Admin terminology glossary loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminTerminologyGlossaryRouter.get(
  "/:conceptId",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const conceptId = Array.isArray(req.params.conceptId)
        ? req.params.conceptId[0]
        : req.params.conceptId;
      const concept = await getAdminTerminologyConcept({
        actorUserId: req.auth!.id,
        conceptId: conceptId ?? "",
      });
      res.json(createSuccessResponse(concept, "Terminology concept loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminTerminologyGlossaryRouter.patch(
  "/:conceptId",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const conceptId = Array.isArray(req.params.conceptId)
        ? req.params.conceptId[0]
        : req.params.conceptId;
      const concept = await updateAdminTerminologyConcept({
        actorUserId: req.auth!.id,
        conceptId: conceptId ?? "",
        body: req.body,
      });
      res.json(createSuccessResponse(concept, "Terminology concept updated."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

export default adminTerminologyGlossaryRouter;
