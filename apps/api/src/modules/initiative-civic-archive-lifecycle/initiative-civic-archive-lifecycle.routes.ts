import { Router, type Request, type Response } from "express";

import { authenticationMiddleware } from "../auth/auth.middleware.js";
import { attachRuntimeLocale } from "../language/runtime-locale.middleware.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";
import {
  downloadDraftArchivePdf,
  downloadPublishedArchivePdf,
  generateInitiativeCivicArchiveDraft,
  getArchiveDocumentByVersionId,
  getInitiativeCivicArchiveWorkspaceContext,
  getPublishedArchiveDocument,
  publishInitiativeCivicArchiveStage,
  saveInitiativeCivicArchiveDraft,
} from "./initiative-civic-archive-lifecycle.service.js";
import { validateSaveInitiativeCivicArchiveLifecycleDraftInput } from "./initiative-civic-archive-lifecycle.validators.js";

const initiativeCivicArchiveLifecycleRouter = Router();

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
    message.includes("is required") ||
    message.includes("no longer current") ||
    message.includes("must be generated") ||
    message.includes("unsupported") ||
    message.includes("Save supports only")
  ) {
    return 409;
  }

  return 400;
}

function handleServiceError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "Civic Archive request failed.";
  res.status(resolveErrorStatus(message)).json(createFailureResponse(message));
}

function getInitiativeId(req: Request): string {
  const initiativeId = req.params.initiativeId;
  return Array.isArray(initiativeId) ? (initiativeId[0] ?? "") : (initiativeId ?? "");
}

function getArchiveVersionId(req: Request): string {
  const archiveVersionId = req.params.archiveVersionId;
  return Array.isArray(archiveVersionId) ? (archiveVersionId[0] ?? "") : (archiveVersionId ?? "");
}

function sendPdf(res: Response, buffer: Buffer, filename: string): void {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length", String(buffer.length));
  res.status(200).end(buffer);
}

initiativeCivicArchiveLifecycleRouter.get(
  "/initiative/:initiativeId/workspace",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const context = await getInitiativeCivicArchiveWorkspaceContext(identity, getInitiativeId(req));

      res.json(createSuccessResponse(context, "Civic Archive workspace loaded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeCivicArchiveLifecycleRouter.post(
  "/initiative/:initiativeId/draft/generate",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const draft = await generateInitiativeCivicArchiveDraft(identity, getInitiativeId(req));

      res.json(createSuccessResponse(draft, "Civic Archive draft generated."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeCivicArchiveLifecycleRouter.patch(
  "/initiative/:initiativeId/draft",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const input = validateSaveInitiativeCivicArchiveLifecycleDraftInput(req.body);
      const draft = saveInitiativeCivicArchiveDraft(identity, getInitiativeId(req), input);

      res.json(createSuccessResponse(draft, "Civic Archive draft saved."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeCivicArchiveLifecycleRouter.post(
  "/initiative/:initiativeId/publish",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const version = await publishInitiativeCivicArchiveStage(identity, getInitiativeId(req));

      res.json(createSuccessResponse(version, "Civic Archive published."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeCivicArchiveLifecycleRouter.get(
  "/initiative/:initiativeId/published",
  async (req, res) => {
    try {
      const packed = await getPublishedArchiveDocument(getInitiativeId(req));

      res.json(
        createSuccessResponse(packed, "Published Civic Archive loaded."),
      );
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeCivicArchiveLifecycleRouter.get(
  "/versions/:archiveVersionId",
  async (req, res) => {
    try {
      const packed = await getArchiveDocumentByVersionId(getArchiveVersionId(req));

      if (!packed) {
        res.status(404).json(createFailureResponse("Civic Archive version not found."));
        return;
      }

      res.json(createSuccessResponse(packed, "Civic Archive version loaded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeCivicArchiveLifecycleRouter.get(
  "/initiative/:initiativeId/document.pdf",
  async (req, res) => {
    try {
      const runtimeLocale = await attachRuntimeLocale(req);
      const { buffer, filename } = await downloadPublishedArchivePdf({
        initiativeId: getInitiativeId(req),
        locale: runtimeLocale.locale,
      });
      sendPdf(res, buffer, filename);
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeCivicArchiveLifecycleRouter.get(
  "/versions/:archiveVersionId/document.pdf",
  async (req, res) => {
    try {
      const runtimeLocale = await attachRuntimeLocale(req);
      const { buffer, filename } = await downloadPublishedArchivePdf({
        archiveVersionId: getArchiveVersionId(req),
        locale: runtimeLocale.locale,
      });
      sendPdf(res, buffer, filename);
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeCivicArchiveLifecycleRouter.get(
  "/initiative/:initiativeId/draft/document.pdf",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const runtimeLocale = await attachRuntimeLocale(req);
      const { buffer, filename } = await downloadDraftArchivePdf(
        identity,
        getInitiativeId(req),
        { locale: runtimeLocale.locale },
      );
      sendPdf(res, buffer, filename);
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

export default initiativeCivicArchiveLifecycleRouter;
