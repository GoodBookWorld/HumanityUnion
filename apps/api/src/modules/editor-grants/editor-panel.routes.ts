import { Router, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import {
  authenticationMiddleware,
  requireAuthenticationMiddleware,
} from "../auth/auth.middleware.js";
import {
  AdministrationForbiddenError,
  AdministrationInsufficientCapabilityError,
  AdministrationScopeMismatchError,
  AdministrationUnauthorizedError,
  AdministrationValidationError,
} from "../administration/administration.errors.js";
import { updatePublicChoiceCandidateAsAdmin } from "../public-choice-candidate/public-choice-candidate.service.js";
import {
  activateAdminMediaResource,
  createAdminMediaResource,
  deactivateAdminMediaResource,
  updateAdminMediaResource,
} from "../media-resources/media-resource.service.js";
import {
  activateAdminCountryAffiliation,
  createAdminCountryAffiliation,
  deactivateAdminCountryAffiliation,
  updateAdminCountryAffiliation,
} from "../country-affiliation/country-affiliation.service.js";
import {
  createBetaInviteForAdmin,
  listBetaInvitesForAdmin,
  revokeBetaInviteForAdmin,
} from "../beta-invite/beta-invite.service.js";
import {
  getInitiativeForEditor,
  republishInitiativeAsEditor,
  updateInitiativeAsEditor,
} from "../initiatives/initiative-editor.service.js";
import { validateSaveInitiativeDraftInput } from "../initiatives/initiative.validators.js";
import {
  blockInitiativeAsEditor,
  blockPublicChoiceCandidateAsEditor,
  unblockInitiativeAsEditor,
  unblockPublicChoiceCandidateAsEditor,
} from "./editor-moderation.service.js";
import {
  getEditorPanel,
  listEditorCountryPeople,
  listEditorInitiatives,
  listEditorMediaResources,
  listEditorPublicChoice,
  listEditorPublicChoiceCandidates,
} from "./editor-panel.service.js";

const editorPanelRouter = Router();

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
  if (
    error instanceof AdministrationForbiddenError ||
    error instanceof AdministrationInsufficientCapabilityError ||
    error instanceof AdministrationScopeMismatchError
  ) {
    return 403;
  }
  if (error instanceof AdministrationValidationError) {
    return 400;
  }
  const message = error instanceof Error ? error.message : "";
  if (/authentication|required/i.test(message)) {
    return 401;
  }
  if (/permission|forbidden|editor|blocked by an administrator/i.test(message)) {
    return 403;
  }
  if (/not found|required|invalid/i.test(message)) {
    return 400;
  }
  return 500;
}

function handleError(res: Response, error: unknown): void {
  const message =
    error instanceof Error ? error.message : "Editor Panel request failed.";
  res.status(resolveErrorStatus(error)).json(createFailureResponse(message));
}

editorPanelRouter.get(
  "/panel",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const panel = await getEditorPanel({ actorUserId: req.auth!.id });
      res.json(createSuccessResponse(panel, "Editor Panel loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

editorPanelRouter.get(
  "/initiatives",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const result = await listEditorInitiatives({
        actorUserId: req.auth!.id,
        limit:
          typeof req.query.limit === "string"
            ? Number.parseInt(req.query.limit, 10)
            : 25,
        offset:
          typeof req.query.offset === "string"
            ? Number.parseInt(req.query.offset, 10)
            : 0,
      });
      res.json(createSuccessResponse(result, "Editor Initiatives loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

editorPanelRouter.get(
  "/initiatives/:initiativeId",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const initiative = await getInitiativeForEditor({
        actorUserId: req.auth!.id,
        initiativeId: String(req.params.initiativeId ?? "").trim(),
      });
      res.json(createSuccessResponse(initiative, "Editor Initiative loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

editorPanelRouter.patch(
  "/initiatives/:initiativeId",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const input = validateSaveInitiativeDraftInput(req.body);
      const initiative = await updateInitiativeAsEditor({
        actorUserId: req.auth!.id,
        initiativeId: String(req.params.initiativeId ?? "").trim(),
        body: input,
      });
      res.json(createSuccessResponse(initiative, "Initiative updated."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

editorPanelRouter.post(
  "/initiatives/:initiativeId/republish",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const body =
        req.body && typeof req.body === "object" && Object.keys(req.body as object).length > 0
          ? validateSaveInitiativeDraftInput(req.body)
          : {};
      const initiative = await republishInitiativeAsEditor({
        actorUserId: req.auth!.id,
        initiativeId: String(req.params.initiativeId ?? "").trim(),
        body,
      });
      res.json(createSuccessResponse(initiative, "Initiative republished."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

editorPanelRouter.post(
  "/initiatives/:initiativeId/block",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const body = req.body as { reason?: string };
      const result = await blockInitiativeAsEditor({
        actorUserId: req.auth!.id,
        initiativeId: String(req.params.initiativeId ?? "").trim(),
        reason: body.reason,
      });
      res.json(createSuccessResponse(result, "Content blocked."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

editorPanelRouter.post(
  "/initiatives/:initiativeId/unblock",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const body = req.body as { reason?: string };
      const result = await unblockInitiativeAsEditor({
        actorUserId: req.auth!.id,
        initiativeId: String(req.params.initiativeId ?? "").trim(),
        reason: body.reason,
      });
      res.json(createSuccessResponse(result, "Content unblocked."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

editorPanelRouter.get(
  "/public-choice",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const result = await listEditorPublicChoice({
        actorUserId: req.auth!.id,
        limit:
          typeof req.query.limit === "string"
            ? Number.parseInt(req.query.limit, 10)
            : 25,
        offset:
          typeof req.query.offset === "string"
            ? Number.parseInt(req.query.offset, 10)
            : 0,
      });
      res.json(createSuccessResponse(result, "Editor Public Choice loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

editorPanelRouter.get(
  "/public-choice/:initiativeId/candidates",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const result = await listEditorPublicChoiceCandidates({
        actorUserId: req.auth!.id,
        initiativeId: String(req.params.initiativeId ?? "").trim(),
      });
      res.json(createSuccessResponse(result, "Editor Public Choice candidates loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

editorPanelRouter.patch(
  "/public-choice/:initiativeId/candidates/:candidateId",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const body = req.body as {
        name?: string;
        photoUrl?: string | null;
        campaignPageUrl?: string | null;
      };
      const candidate = await updatePublicChoiceCandidateAsAdmin({
        actorUserId: req.auth!.id,
        initiativeId: String(req.params.initiativeId ?? "").trim(),
        candidateId: String(req.params.candidateId ?? "").trim(),
        name: body.name,
        photoUrl: body.photoUrl,
        campaignPageUrl: body.campaignPageUrl,
      });
      res.json(createSuccessResponse(candidate, "Candidate updated."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

editorPanelRouter.post(
  "/public-choice/:initiativeId/candidates/:candidateId/block",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const body = req.body as { reason?: string };
      const result = await blockPublicChoiceCandidateAsEditor({
        actorUserId: req.auth!.id,
        initiativeId: String(req.params.initiativeId ?? "").trim(),
        candidateId: String(req.params.candidateId ?? "").trim(),
        reason: body.reason,
      });
      res.json(createSuccessResponse(result, "Candidate blocked."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

editorPanelRouter.post(
  "/public-choice/:initiativeId/candidates/:candidateId/unblock",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const body = req.body as { reason?: string };
      const result = await unblockPublicChoiceCandidateAsEditor({
        actorUserId: req.auth!.id,
        initiativeId: String(req.params.initiativeId ?? "").trim(),
        candidateId: String(req.params.candidateId ?? "").trim(),
        reason: body.reason,
      });
      res.json(createSuccessResponse(result, "Candidate unblocked."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

editorPanelRouter.get(
  "/media-resources",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const items = await listEditorMediaResources({ actorUserId: req.auth!.id });
      res.json(createSuccessResponse({ items }, "Editor Media Resources loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

editorPanelRouter.post(
  "/media-resources",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const resource = await createAdminMediaResource({
        actorUserId: req.auth!.id,
        ...(req.body as object),
      } as Parameters<typeof createAdminMediaResource>[0]);
      res.status(201).json(createSuccessResponse(resource, "Media resource created."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

editorPanelRouter.patch(
  "/media-resources/:id",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const resource = await updateAdminMediaResource({
        actorUserId: req.auth!.id,
        id: String(req.params.id ?? "").trim(),
        ...(req.body as object),
      } as Parameters<typeof updateAdminMediaResource>[0]);
      res.json(createSuccessResponse(resource, "Media resource updated."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

editorPanelRouter.post(
  "/media-resources/:id/activate",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const resource = await activateAdminMediaResource({
        actorUserId: req.auth!.id,
        id: String(req.params.id ?? "").trim(),
      });
      res.json(createSuccessResponse(resource, "Media resource activated."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

editorPanelRouter.post(
  "/media-resources/:id/deactivate",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const resource = await deactivateAdminMediaResource({
        actorUserId: req.auth!.id,
        id: String(req.params.id ?? "").trim(),
      });
      res.json(createSuccessResponse(resource, "Media resource deactivated."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

editorPanelRouter.get(
  "/country-people",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const items = await listEditorCountryPeople({ actorUserId: req.auth!.id });
      res.json(createSuccessResponse({ items }, "Editor Country Team loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

editorPanelRouter.post(
  "/country-people",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const entry = await createAdminCountryAffiliation({
        actorUserId: req.auth!.id,
        ...(req.body as object),
      } as Parameters<typeof createAdminCountryAffiliation>[0]);
      res.status(201).json(createSuccessResponse(entry, "Affiliation created."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

editorPanelRouter.patch(
  "/country-people/:entryId",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const entry = await updateAdminCountryAffiliation({
        actorUserId: req.auth!.id,
        entryId: String(req.params.entryId ?? "").trim(),
        ...(req.body as object),
      } as Parameters<typeof updateAdminCountryAffiliation>[0]);
      res.json(createSuccessResponse(entry, "Affiliation updated."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

editorPanelRouter.post(
  "/country-people/:entryId/activate",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const entry = await activateAdminCountryAffiliation({
        actorUserId: req.auth!.id,
        entryId: String(req.params.entryId ?? "").trim(),
      });
      res.json(createSuccessResponse(entry, "Affiliation activated."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

editorPanelRouter.post(
  "/country-people/:entryId/deactivate",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const entry = await deactivateAdminCountryAffiliation({
        actorUserId: req.auth!.id,
        entryId: String(req.params.entryId ?? "").trim(),
      });
      res.json(createSuccessResponse(entry, "Affiliation deactivated."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

editorPanelRouter.get(
  "/beta-invites",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const invites = await listBetaInvitesForAdmin(req.auth!.id);
      res.json(createSuccessResponse({ invites }, "Beta invites loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

editorPanelRouter.post(
  "/beta-invites",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const body = req.body as { email?: string };
      const result = await createBetaInviteForAdmin({
        createdBy: req.auth!.id,
        email: body.email ?? "",
      });
      res.status(201).json(createSuccessResponse(result, "Beta invite created."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

editorPanelRouter.post(
  "/beta-invites/:inviteId/revoke",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const invite = await revokeBetaInviteForAdmin({
        inviteId: String(req.params.inviteId ?? ""),
        actorUserId: req.auth!.id,
      });
      res.json(createSuccessResponse({ invite }, "Beta invite revoked."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

export default editorPanelRouter;
