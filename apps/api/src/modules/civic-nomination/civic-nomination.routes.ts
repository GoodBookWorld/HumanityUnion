import { Router, type Request, type Response } from "express";

import { authenticationMiddleware } from "../auth/auth.middleware.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";

import {
  archiveCivicNomination,
  createCivicNominationDraft,
  getMyCivicNomination,
  listMyCivicNominations,
  publishCivicNomination,
  resolveCivicNominationAuthContext,
  submitCivicNomination,
  updateCivicNominationDraft,
  withdrawCivicNomination,
} from "./civic-nomination.service.js";
import { registerCivicNominationVoteRoutes } from "../civic-nomination-vote/civic-nomination-vote.routes.js";

const civicNominationRouter = Router();
registerCivicNominationVoteRoutes(civicNominationRouter);

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

  if (message.includes("do not have access") || message.includes("privileges are required")) {
    return 403;
  }

  if (
    message.includes("Only draft") ||
    message.includes("Cannot transition") ||
    message.includes("can be withdrawn")
  ) {
    return 409;
  }

  return 400;
}

function handleServiceError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "Civic nomination request failed.";
  res.status(resolveErrorStatus(message)).json(createFailureResponse(message));
}

function getNominationId(req: Request): string {
  const nominationId = req.params.nominationId;
  return Array.isArray(nominationId) ? (nominationId[0] ?? "") : (nominationId ?? "");
}

async function resolveAuthContext(req: Request) {
  const userId = req.auth?.id;

  if (!userId) {
    throw new Error("Authentication is required.");
  }

  return resolveCivicNominationAuthContext(userId);
}

civicNominationRouter.post("/", authenticationMiddleware, async (req, res) => {
  try {
    const auth = await resolveAuthContext(req);
    const nomination = createCivicNominationDraft(auth, req.body as Record<string, unknown>);
    res.status(201).json(createSuccessResponse(nomination, "Civic nomination draft created."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

civicNominationRouter.get("/mine", authenticationMiddleware, async (req, res) => {
  try {
    const auth = await resolveAuthContext(req);
    const nominations = listMyCivicNominations(auth.profileId);
    res.json(createSuccessResponse(nominations, "My civic nominations loaded."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

civicNominationRouter.get("/:nominationId", authenticationMiddleware, async (req, res) => {
  try {
    const auth = await resolveAuthContext(req);
    const nomination = getMyCivicNomination(getNominationId(req), auth.profileId);
    res.json(createSuccessResponse(nomination, "Civic nomination loaded."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

civicNominationRouter.patch("/:nominationId", authenticationMiddleware, async (req, res) => {
  try {
    const auth = await resolveAuthContext(req);
    const nomination = updateCivicNominationDraft(
      getNominationId(req),
      auth.profileId,
      req.body as Record<string, unknown>,
    );
    res.json(createSuccessResponse(nomination, "Civic nomination draft updated."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

civicNominationRouter.post("/:nominationId/submit", authenticationMiddleware, async (req, res) => {
  try {
    const auth = await resolveAuthContext(req);
    const nomination = submitCivicNomination(getNominationId(req), auth);
    res.json(createSuccessResponse(nomination, "Civic nomination submitted."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

civicNominationRouter.post(
  "/:nominationId/withdraw",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const auth = await resolveAuthContext(req);
      const nomination = withdrawCivicNomination(getNominationId(req), auth);
      res.json(createSuccessResponse(nomination, "Civic nomination withdrawn."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

civicNominationRouter.post("/:nominationId/publish", authenticationMiddleware, async (req, res) => {
  try {
    const identity = await resolveRequestIdentity(req);
    const nomination = await publishCivicNomination(getNominationId(req), identity);
    res.json(createSuccessResponse(nomination, "Civic nomination published."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

civicNominationRouter.post("/:nominationId/archive", authenticationMiddleware, async (req, res) => {
  try {
    const identity = await resolveRequestIdentity(req);
    const nomination = archiveCivicNomination(getNominationId(req), identity);
    res.json(createSuccessResponse(nomination, "Civic nomination archived."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

export { civicNominationRouter };
