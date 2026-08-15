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
 * Communication UX Pack 03.7 Part 7 — Direct Conversation Shared
 * Documents. Mounted at the same `/api/v1/direct-messages` base as
 * `direct-messaging.routes.ts` (Part 1: one unified module, but each
 * context keeps its own idiomatic route shape).
 */
export const sharedDocumentsDirectMessagesRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SHARED_DOCUMENT_SIZE_BYTES, files: 1 },
});

sharedDocumentsDirectMessagesRouter.use(requireJwtAuthenticationMiddleware);

sharedDocumentsDirectMessagesRouter.get(
  "/conversations/:conversationId/documents",
  async (req: Request, res: Response) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const result = await listSharedDocuments(
        { contextType: "direct_conversation", conversationId: resolveParam(req.params.conversationId) },
        identity.participantId,
      );

      res.json(createSuccessResponse(result, "Shared documents loaded."));
    } catch (error) {
      handleSharedDocumentServiceError(res, error);
    }
  },
);

sharedDocumentsDirectMessagesRouter.post(
  "/conversations/:conversationId/documents",
  mediaUploadRateLimiter,
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const view = await uploadSharedDocument(
        { contextType: "direct_conversation", conversationId: resolveParam(req.params.conversationId) },
        identity.participantId,
        {
          originalName: req.file?.originalname,
          buffer: req.file?.buffer,
          mimeType: req.file?.mimetype ?? "",
          size: req.file?.size ?? 0,
        },
      );

      res.status(201).json(createSuccessResponse(view, "Document uploaded."));
    } catch (error) {
      handleSharedDocumentServiceError(res, error);
    }
  },
);

sharedDocumentsDirectMessagesRouter.get(
  "/conversations/:conversationId/documents/:documentId/download",
  async (req: Request, res: Response) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const target = await resolveSharedDocumentDownload(
        { contextType: "direct_conversation", conversationId: resolveParam(req.params.conversationId) },
        resolveParam(req.params.documentId),
        identity.participantId,
      );

      await streamSharedDocumentDownload(res, target);
    } catch (error) {
      handleSharedDocumentServiceError(res, error);
    }
  },
);

sharedDocumentsDirectMessagesRouter.put(
  "/conversations/:conversationId/documents/:documentId",
  mediaUploadRateLimiter,
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const view = await replaceSharedDocument(
        { contextType: "direct_conversation", conversationId: resolveParam(req.params.conversationId) },
        resolveParam(req.params.documentId),
        identity.participantId,
        {
          originalName: req.file?.originalname,
          buffer: req.file?.buffer,
          mimeType: req.file?.mimetype ?? "",
          size: req.file?.size ?? 0,
        },
      );

      res.json(createSuccessResponse(view, "Document replaced."));
    } catch (error) {
      handleSharedDocumentServiceError(res, error);
    }
  },
);

sharedDocumentsDirectMessagesRouter.delete(
  "/conversations/:conversationId/documents/:documentId",
  async (req: Request, res: Response) => {
    try {
      const identity = await resolveRequestIdentity(req);
      await removeSharedDocument(
        { contextType: "direct_conversation", conversationId: resolveParam(req.params.conversationId) },
        resolveParam(req.params.documentId),
        identity.participantId,
      );

      res.json(createSuccessResponse(null, "Document removed."));
    } catch (error) {
      handleSharedDocumentServiceError(res, error);
    }
  },
);

export default sharedDocumentsDirectMessagesRouter;
