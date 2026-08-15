import { Router, type Request, type Response } from "express";
import multer from "multer";

import { createSuccessResponse } from "../../shared/http-response.js";
import { requireJwtAuthenticationMiddleware } from "../auth/auth.middleware.js";
import { mediaUploadRateLimiter } from "../media-upload/media-upload-rate-limit.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";

import {
  listSharedDocuments,
  removeSharedDocument,
  replaceSharedDocument,
  resolveSharedDocumentDownload,
  uploadSharedDocument,
} from "./shared-documents.service.js";
import { MAX_SHARED_DOCUMENT_SIZE_BYTES } from "./shared-documents.validators.js";
import { streamSharedDocumentDownload } from "./shared-documents-download.js";
import { handleSharedDocumentServiceError, resolveParam } from "./shared-documents.route-helpers.js";

/**
 * Communication UX Pack 03.7 Part 1/7 — Collaboration Channel and
 * Collaboration Session Shared Documents. Mounted at the same
 * `/api/v1/public/initiatives` base as `initiativeCollaborationChannelRouter`
 * and `initiativeCollaborationSessionsRouter` (Part 1: one unified
 * module, idiomatic per-context route shape).
 */
export const sharedDocumentsInitiativesRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SHARED_DOCUMENT_SIZE_BYTES, files: 1 },
});

sharedDocumentsInitiativesRouter.use(requireJwtAuthenticationMiddleware);

function extractUploadFile(req: Request) {
  return {
    originalName: req.file?.originalname,
    buffer: req.file?.buffer,
    mimeType: req.file?.mimetype ?? "",
    size: req.file?.size ?? 0,
  };
}

// --- Collaboration Channel ---

sharedDocumentsInitiativesRouter.get(
  "/:initiativeId/collaboration-channel/documents",
  async (req: Request, res: Response) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const result = await listSharedDocuments(
        { contextType: "collaboration_channel", initiativeId: resolveParam(req.params.initiativeId) },
        identity.participantId,
      );

      res.json(createSuccessResponse(result, "Shared documents loaded."));
    } catch (error) {
      handleSharedDocumentServiceError(res, error);
    }
  },
);

sharedDocumentsInitiativesRouter.post(
  "/:initiativeId/collaboration-channel/documents",
  mediaUploadRateLimiter,
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const view = await uploadSharedDocument(
        { contextType: "collaboration_channel", initiativeId: resolveParam(req.params.initiativeId) },
        identity.participantId,
        extractUploadFile(req),
      );

      res.status(201).json(createSuccessResponse(view, "Document uploaded."));
    } catch (error) {
      handleSharedDocumentServiceError(res, error);
    }
  },
);

sharedDocumentsInitiativesRouter.get(
  "/:initiativeId/collaboration-channel/documents/:documentId/download",
  async (req: Request, res: Response) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const target = await resolveSharedDocumentDownload(
        { contextType: "collaboration_channel", initiativeId: resolveParam(req.params.initiativeId) },
        resolveParam(req.params.documentId),
        identity.participantId,
      );

      await streamSharedDocumentDownload(res, target);
    } catch (error) {
      handleSharedDocumentServiceError(res, error);
    }
  },
);

sharedDocumentsInitiativesRouter.put(
  "/:initiativeId/collaboration-channel/documents/:documentId",
  mediaUploadRateLimiter,
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const view = await replaceSharedDocument(
        { contextType: "collaboration_channel", initiativeId: resolveParam(req.params.initiativeId) },
        resolveParam(req.params.documentId),
        identity.participantId,
        extractUploadFile(req),
      );

      res.json(createSuccessResponse(view, "Document replaced."));
    } catch (error) {
      handleSharedDocumentServiceError(res, error);
    }
  },
);

sharedDocumentsInitiativesRouter.delete(
  "/:initiativeId/collaboration-channel/documents/:documentId",
  async (req: Request, res: Response) => {
    try {
      const identity = await resolveRequestIdentity(req);
      await removeSharedDocument(
        { contextType: "collaboration_channel", initiativeId: resolveParam(req.params.initiativeId) },
        resolveParam(req.params.documentId),
        identity.participantId,
      );

      res.json(createSuccessResponse(null, "Document removed."));
    } catch (error) {
      handleSharedDocumentServiceError(res, error);
    }
  },
);

// --- Collaboration Sessions ---

sharedDocumentsInitiativesRouter.get(
  "/:initiativeId/collaboration-sessions/:sessionId/documents",
  async (req: Request, res: Response) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const result = await listSharedDocuments(
        {
          contextType: "collaboration_session",
          initiativeId: resolveParam(req.params.initiativeId),
          sessionId: resolveParam(req.params.sessionId),
        },
        identity.participantId,
      );

      res.json(createSuccessResponse(result, "Shared documents loaded."));
    } catch (error) {
      handleSharedDocumentServiceError(res, error);
    }
  },
);

sharedDocumentsInitiativesRouter.post(
  "/:initiativeId/collaboration-sessions/:sessionId/documents",
  mediaUploadRateLimiter,
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const view = await uploadSharedDocument(
        {
          contextType: "collaboration_session",
          initiativeId: resolveParam(req.params.initiativeId),
          sessionId: resolveParam(req.params.sessionId),
        },
        identity.participantId,
        extractUploadFile(req),
      );

      res.status(201).json(createSuccessResponse(view, "Document uploaded."));
    } catch (error) {
      handleSharedDocumentServiceError(res, error);
    }
  },
);

sharedDocumentsInitiativesRouter.get(
  "/:initiativeId/collaboration-sessions/:sessionId/documents/:documentId/download",
  async (req: Request, res: Response) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const target = await resolveSharedDocumentDownload(
        {
          contextType: "collaboration_session",
          initiativeId: resolveParam(req.params.initiativeId),
          sessionId: resolveParam(req.params.sessionId),
        },
        resolveParam(req.params.documentId),
        identity.participantId,
      );

      await streamSharedDocumentDownload(res, target);
    } catch (error) {
      handleSharedDocumentServiceError(res, error);
    }
  },
);

sharedDocumentsInitiativesRouter.put(
  "/:initiativeId/collaboration-sessions/:sessionId/documents/:documentId",
  mediaUploadRateLimiter,
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const view = await replaceSharedDocument(
        {
          contextType: "collaboration_session",
          initiativeId: resolveParam(req.params.initiativeId),
          sessionId: resolveParam(req.params.sessionId),
        },
        resolveParam(req.params.documentId),
        identity.participantId,
        extractUploadFile(req),
      );

      res.json(createSuccessResponse(view, "Document replaced."));
    } catch (error) {
      handleSharedDocumentServiceError(res, error);
    }
  },
);

sharedDocumentsInitiativesRouter.delete(
  "/:initiativeId/collaboration-sessions/:sessionId/documents/:documentId",
  async (req: Request, res: Response) => {
    try {
      const identity = await resolveRequestIdentity(req);
      await removeSharedDocument(
        {
          contextType: "collaboration_session",
          initiativeId: resolveParam(req.params.initiativeId),
          sessionId: resolveParam(req.params.sessionId),
        },
        resolveParam(req.params.documentId),
        identity.participantId,
      );

      res.json(createSuccessResponse(null, "Document removed."));
    } catch (error) {
      handleSharedDocumentServiceError(res, error);
    }
  },
);

// --- Official Responses (Initiative Lifecycle — Part K, Section 7) ---

sharedDocumentsInitiativesRouter.get(
  "/:initiativeId/official-responses/:responseId/documents",
  async (req: Request, res: Response) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const result = await listSharedDocuments(
        {
          contextType: "official_response",
          initiativeId: resolveParam(req.params.initiativeId),
          responseId: resolveParam(req.params.responseId),
        },
        identity.participantId,
      );

      res.json(createSuccessResponse(result, "Shared documents loaded."));
    } catch (error) {
      handleSharedDocumentServiceError(res, error);
    }
  },
);

sharedDocumentsInitiativesRouter.post(
  "/:initiativeId/official-responses/:responseId/documents",
  mediaUploadRateLimiter,
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const view = await uploadSharedDocument(
        {
          contextType: "official_response",
          initiativeId: resolveParam(req.params.initiativeId),
          responseId: resolveParam(req.params.responseId),
        },
        identity.participantId,
        extractUploadFile(req),
      );

      res.status(201).json(createSuccessResponse(view, "Document uploaded."));
    } catch (error) {
      handleSharedDocumentServiceError(res, error);
    }
  },
);

sharedDocumentsInitiativesRouter.get(
  "/:initiativeId/official-responses/:responseId/documents/:documentId/download",
  async (req: Request, res: Response) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const target = await resolveSharedDocumentDownload(
        {
          contextType: "official_response",
          initiativeId: resolveParam(req.params.initiativeId),
          responseId: resolveParam(req.params.responseId),
        },
        resolveParam(req.params.documentId),
        identity.participantId,
      );

      await streamSharedDocumentDownload(res, target);
    } catch (error) {
      handleSharedDocumentServiceError(res, error);
    }
  },
);

sharedDocumentsInitiativesRouter.delete(
  "/:initiativeId/official-responses/:responseId/documents/:documentId",
  async (req: Request, res: Response) => {
    try {
      const identity = await resolveRequestIdentity(req);
      await removeSharedDocument(
        {
          contextType: "official_response",
          initiativeId: resolveParam(req.params.initiativeId),
          responseId: resolveParam(req.params.responseId),
        },
        resolveParam(req.params.documentId),
        identity.participantId,
      );

      res.json(createSuccessResponse(null, "Document removed."));
    } catch (error) {
      handleSharedDocumentServiceError(res, error);
    }
  },
);

export default sharedDocumentsInitiativesRouter;
