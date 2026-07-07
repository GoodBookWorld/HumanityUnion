import { Router, type Request, type Response } from "express";

import { authenticationMiddleware } from "../auth/auth.middleware.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";
import {
  createPublicCivicArchiveDraft,
  getMyPublicCivicArchiveRecord,
  listMyPublicCivicArchiveRecords,
  publishPublicCivicArchive,
  updatePublicCivicArchiveDraft,
} from "./public-civic-archive.service.js";

const publicCivicArchiveRouter = Router();

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
    message.includes("Only verified") ||
    message.includes("already exists") ||
    message.includes("requires")
  ) {
    return 409;
  }

  return 400;
}

function handleServiceError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "Public civic archive request failed.";
  res.status(resolveErrorStatus(message)).json(createFailureResponse(message));
}

function getArchiveRecordId(req: Request): string {
  const archiveRecordId = req.params.archiveRecordId;
  return Array.isArray(archiveRecordId) ? (archiveRecordId[0] ?? "") : (archiveRecordId ?? "");
}

publicCivicArchiveRouter.get("/mine", authenticationMiddleware, (req, res) => {
  const identity = resolveRequestIdentity(req);
  const records = listMyPublicCivicArchiveRecords(identity);

  res.json(createSuccessResponse(records, "My civic archive records loaded."));
});

publicCivicArchiveRouter.get("/:archiveRecordId", authenticationMiddleware, (req, res) => {
  try {
    const identity = resolveRequestIdentity(req);
    const record = getMyPublicCivicArchiveRecord(identity, getArchiveRecordId(req));

    res.json(createSuccessResponse(record, "Civic archive record loaded."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

publicCivicArchiveRouter.post("/draft", authenticationMiddleware, (req, res) => {
  try {
    const identity = resolveRequestIdentity(req);
    const record = createPublicCivicArchiveDraft(identity, req.body);

    res.status(201).json(createSuccessResponse(record, "Civic archive draft created."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

publicCivicArchiveRouter.patch("/:archiveRecordId/draft", authenticationMiddleware, (req, res) => {
  try {
    const identity = resolveRequestIdentity(req);
    const record = updatePublicCivicArchiveDraft(identity, getArchiveRecordId(req), req.body);

    res.json(createSuccessResponse(record, "Civic archive draft updated."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

publicCivicArchiveRouter.post("/:archiveRecordId/publish", authenticationMiddleware, (req, res) => {
  try {
    const identity = resolveRequestIdentity(req);
    const record = publishPublicCivicArchive(identity, getArchiveRecordId(req));

    res.json(createSuccessResponse(record, "Civic archive record published."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

export default publicCivicArchiveRouter;
