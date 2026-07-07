import { Router, type Request, type Response } from "express";

import { authenticationMiddleware } from "../auth/auth.middleware.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";
import {
  archiveOfficialResponse,
  createOfficialResponseDraft,
  getMyOfficialResponse,
  listMyOfficialResponses,
  publishOfficialResponse,
  updateOfficialResponseDraft,
  verifyOfficialResponse,
} from "./official-response.service.js";

const officialResponseRouter = Router();

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

  if (
    message.includes("Only draft") ||
    message.includes("already final") ||
    message.includes("cannot be")
  ) {
    return 409;
  }

  return 400;
}

function handleServiceError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "Official response request failed.";
  res.status(resolveErrorStatus(message)).json(createFailureResponse(message));
}

function getResponseId(req: Request): string {
  const responseId = req.params.responseId;
  return Array.isArray(responseId) ? (responseId[0] ?? "") : (responseId ?? "");
}

officialResponseRouter.get("/mine", authenticationMiddleware, (req, res) => {
  const identity = resolveRequestIdentity(req);
  const responses = listMyOfficialResponses(identity);

  res.json(createSuccessResponse(responses, "Official responses loaded."));
});

officialResponseRouter.post("/draft", authenticationMiddleware, (req, res) => {
  try {
    const identity = resolveRequestIdentity(req);
    const response = createOfficialResponseDraft(identity, req.body);

    res.status(201).json(createSuccessResponse(response, "Official response draft created."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

officialResponseRouter.get("/:responseId", authenticationMiddleware, (req, res) => {
  const identity = resolveRequestIdentity(req);
  const response = getMyOfficialResponse(identity, getResponseId(req));

  if (!response) {
    res.status(404).json(createFailureResponse("Official response not found."));
    return;
  }

  res.json(createSuccessResponse(response, "Official response loaded."));
});

officialResponseRouter.patch("/:responseId/draft", authenticationMiddleware, (req, res) => {
  try {
    const identity = resolveRequestIdentity(req);
    const response = updateOfficialResponseDraft(identity, getResponseId(req), req.body);

    res.json(createSuccessResponse(response, "Official response draft updated."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

officialResponseRouter.post("/:responseId/publish", authenticationMiddleware, (req, res) => {
  try {
    const identity = resolveRequestIdentity(req);
    const response = publishOfficialResponse(identity, getResponseId(req));

    res.json(createSuccessResponse(response, "Official response published."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

officialResponseRouter.post("/:responseId/verify", authenticationMiddleware, (req, res) => {
  try {
    const identity = resolveRequestIdentity(req);
    const verificationState = req.body?.verificationState;

    if (verificationState !== "verified" && verificationState !== "unable_to_verify") {
      res
        .status(400)
        .json(createFailureResponse("verificationState must be verified or unable_to_verify."));
      return;
    }

    const response = verifyOfficialResponse(identity, getResponseId(req), verificationState);

    res.json(createSuccessResponse(response, "Official response verification updated."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

officialResponseRouter.post("/:responseId/archive", authenticationMiddleware, (req, res) => {
  try {
    const identity = resolveRequestIdentity(req);
    const response = archiveOfficialResponse(identity, getResponseId(req));

    res.json(createSuccessResponse(response, "Official response archived."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

export default officialResponseRouter;
