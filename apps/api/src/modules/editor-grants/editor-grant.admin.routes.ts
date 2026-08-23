import { Router, type Response } from "express";
import type { EditorCapabilityId, EditorGeographicScope, EditorGrantStatus } from "@hu/types";

import { createSuccessResponse } from "../../shared/http-response.js";
import {
  authenticationMiddleware,
  requireAuthenticationMiddleware,
} from "../auth/auth.middleware.js";
import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
  AdministrationValidationError,
} from "../administration/administration.errors.js";
import {
  activateEditorGrant,
  assignEditorGrant,
  deactivateEditorGrant,
  getAdminEditor,
  getAdminEditorSummary,
  listAdminEditors,
  updateEditorGrant,
} from "./editor-grant.admin.service.js";

const adminEditorGrantsRouter = Router();

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
  if (error instanceof AdministrationValidationError) {
    return 400;
  }
  return 500;
}

function handleError(res: Response, error: unknown): void {
  const message =
    error instanceof Error ? error.message : "Admin Editors request failed.";
  res.status(resolveErrorStatus(error)).json(createFailureResponse(message));
}

function parseStatus(value: unknown): EditorGrantStatus | undefined {
  if (value === "ACTIVE" || value === "INACTIVE") {
    return value;
  }
  return undefined;
}

adminEditorGrantsRouter.get(
  "/summary",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const summary = await getAdminEditorSummary({ actorUserId: req.auth!.id });
      res.json(createSuccessResponse(summary, "Editor summary loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminEditorGrantsRouter.get(
  "/",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const status = parseStatus(req.query.status);
      const limit =
        typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : 25;
      const offset =
        typeof req.query.offset === "string" ? Number.parseInt(req.query.offset, 10) : 0;

      const result = await listAdminEditors({
        actorUserId: req.auth!.id,
        status,
        limit,
        offset,
      });
      res.json(createSuccessResponse(result, "Editors loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminEditorGrantsRouter.get(
  "/:editorGrantId",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const editor = await getAdminEditor({
        actorUserId: req.auth!.id,
        editorGrantId: String(req.params.editorGrantId ?? "").trim(),
      });
      res.json(createSuccessResponse(editor, "Editor loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminEditorGrantsRouter.post(
  "/",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const body = req.body as {
        participantId?: string;
        capabilities?: EditorCapabilityId[];
        geographicScope?: EditorGeographicScope;
        status?: EditorGrantStatus;
      };

      const editor = await assignEditorGrant({
        actorUserId: req.auth!.id,
        body: {
          participantId: body.participantId ?? "",
          capabilities: body.capabilities ?? [],
          geographicScope: body.geographicScope ?? { level: "WORLD" },
          status: body.status,
        },
      });
      res.status(201).json(createSuccessResponse(editor, "Editor assigned."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminEditorGrantsRouter.patch(
  "/:editorGrantId",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const body = req.body as {
        capabilities?: EditorCapabilityId[];
        geographicScope?: EditorGeographicScope;
        status?: EditorGrantStatus;
      };

      const editor = await updateEditorGrant({
        actorUserId: req.auth!.id,
        editorGrantId: String(req.params.editorGrantId ?? "").trim(),
        body,
      });
      res.json(createSuccessResponse(editor, "Editor updated."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminEditorGrantsRouter.post(
  "/:editorGrantId/activate",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const editor = await activateEditorGrant({
        actorUserId: req.auth!.id,
        editorGrantId: String(req.params.editorGrantId ?? "").trim(),
      });
      res.json(createSuccessResponse(editor, "Editor activated."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminEditorGrantsRouter.post(
  "/:editorGrantId/deactivate",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const editor = await deactivateEditorGrant({
        actorUserId: req.auth!.id,
        editorGrantId: String(req.params.editorGrantId ?? "").trim(),
      });
      res.json(createSuccessResponse(editor, "Editor deactivated."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

export default adminEditorGrantsRouter;
