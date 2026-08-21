import { Router, type Request, type Response } from "express";

import { authenticatedWorkspaceWriteMiddleware } from "../auth/auth-workspace-gate.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import { resolveRequestIdentity } from "./identity/resolve-request-identity.js";
import {
  archiveInitiative,
  createInitiativeDraft,
  deleteInitiativeDraft,
  listMyInitiativeGroups,
  listMyInitiatives,
  publishInitiative,
  republishInitiative,
  saveInitiativeDraft,
  updateManagedInitiative,
  updatePublishedInitiative,
} from "./initiative.service.js";
import { getInitiativeOwnerAccess } from "./initiative-owner-access.service.js";
import { getInitiativeById, listInitiatives } from "./initiative.store.js";
import {
  canExposePublicInitiativeProjection,
  toPublicInitiativeProjection,
} from "./public-initiative.projection.js";
import {
  validateCreateInitiativeDraftInput,
  validateSaveInitiativeDraftInput,
} from "./initiative.validators.js";
import { buildInitiativeNewsSourceSnapshot } from "../public-news/public-news.service.js";

const initiativesRouter = Router();

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
    message.includes("Only draft initiatives") ||
    message.includes("Only published or projected") ||
    message.includes("already archived") ||
    message.includes("Archived initiatives cannot be updated") ||
    message.includes("not allowed")
  ) {
    return 409;
  }

  return 400;
}

function handleServiceError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "Initiative request failed.";
  res.status(resolveErrorStatus(message)).json(createFailureResponse(message));
}

function getInitiativeId(req: Request): string {
  const initiativeId = req.params.initiativeId;
  return Array.isArray(initiativeId) ? (initiativeId[0] ?? "") : (initiativeId ?? "");
}

/** Public read — lists all initiatives (bootstrap operational view). */
initiativesRouter.get("/", (_req, res) => {
  const initiatives = listInitiatives();

  res.json(createSuccessResponse(initiatives, "Initiatives loaded."));
});

/** Identity-scoped read — current participant initiatives only. */
initiativesRouter.get("/mine", ...authenticatedWorkspaceWriteMiddleware, async (req, res) => {
  const identity = await resolveRequestIdentity(req);
  const initiatives = listMyInitiatives(identity);

  res.json(createSuccessResponse(initiatives, "My initiatives loaded."));
});

/**
 * Communication UX Pack 03.9 Part 3 — Initiative Group Chat picker read:
 * every Initiative the signed-in Participant authors OR actively
 * collaborates on. Mounted before `/:initiativeId` so the literal segment
 * `my-groups` is never swallowed by the dynamic route.
 */
initiativesRouter.get("/my-groups", ...authenticatedWorkspaceWriteMiddleware, async (req, res) => {
  try {
    const identity = await resolveRequestIdentity(req);
    const groups = await listMyInitiativeGroups(identity);

    res.json(createSuccessResponse(groups, "My Initiative Groups loaded."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

/** Canonical draft creation route. */
initiativesRouter.post("/draft", ...authenticatedWorkspaceWriteMiddleware, async (req, res) => {
  try {
    const identity = await resolveRequestIdentity(req);
    const input = validateCreateInitiativeDraftInput(req.body);
    const sourceReferences = input.sourceNewsId
      ? [await buildInitiativeNewsSourceSnapshot(input.sourceNewsId)]
      : input.sourceReferences;
    const created = createInitiativeDraft(identity, {
      ...input,
      sourceReferences,
    });

    res.status(201).json(createSuccessResponse(created, "Initiative draft created."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

/**
 * Legacy create alias — delegates to canonical draft creation with RequestIdentity.
 * Prefer POST /draft for new clients.
 */
initiativesRouter.post("/", ...authenticatedWorkspaceWriteMiddleware, async (req, res) => {
  try {
    const identity = await resolveRequestIdentity(req);
    const input = validateCreateInitiativeDraftInput(req.body);
    const sourceReferences = input.sourceNewsId
      ? [await buildInitiativeNewsSourceSnapshot(input.sourceNewsId)]
      : input.sourceReferences;
    const created = createInitiativeDraft(identity, {
      ...input,
      sourceReferences,
    });

    res.status(201).json(createSuccessResponse(created, "Initiative draft created."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

/** Public read — identity-scoped owner studio access. Never returns private data to non-owners. */
initiativesRouter.get(
  "/:initiativeId/owner-access",
  ...authenticatedWorkspaceWriteMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const access = getInitiativeOwnerAccess({
        initiativeId: getInitiativeId(req),
        identity,
      });

      res.json(createSuccessResponse(access, "Initiative owner access resolved."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

/** Public read — single initiative record. */
initiativesRouter.get("/:initiativeId", async (req, res) => {
  const initiative = getInitiativeById(getInitiativeId(req));

  if (!initiative) {
    res.status(404).json(createFailureResponse("Initiative not found."));
    return;
  }

  res.json(createSuccessResponse(initiative, "Initiative loaded."));
});

initiativesRouter.patch(
  "/:initiativeId/draft",
  ...authenticatedWorkspaceWriteMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const input = validateSaveInitiativeDraftInput(req.body);
      const initiative = saveInitiativeDraft(identity, getInitiativeId(req), input);

      res.json(createSuccessResponse(initiative, "Initiative draft saved."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativesRouter.patch(
  "/:initiativeId/published",
  ...authenticatedWorkspaceWriteMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const input = validateSaveInitiativeDraftInput(req.body);
      const initiative = updatePublishedInitiative(identity, getInitiativeId(req), input);

      res.json(createSuccessResponse(initiative, "Initiative updated."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

/**
 * Legacy update alias — delegates to lifecycle-aware update with RequestIdentity.
 * Prefer PATCH /:id/draft or PATCH /:id/published for explicit lifecycle intent.
 */
initiativesRouter.patch("/:initiativeId", ...authenticatedWorkspaceWriteMiddleware, async (req, res) => {
  try {
    const identity = await resolveRequestIdentity(req);
    const input = validateSaveInitiativeDraftInput(req.body);
    const initiative = updateManagedInitiative(identity, getInitiativeId(req), input);

    res.json(createSuccessResponse(initiative, "Initiative updated."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

/**
 * Initiative UX Pack 01.1 — permanently deletes an unpublished Draft
 * Initiative. Mounted on the same `/:initiativeId/draft` resource as the
 * PATCH save-draft route above (DELETE on that resource is the natural,
 * RESTful complement — no separate "/delete" action route).
 */
initiativesRouter.delete(
  "/:initiativeId/draft",
  ...authenticatedWorkspaceWriteMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      await deleteInitiativeDraft(identity, getInitiativeId(req));

      res.json(createSuccessResponse(null, "Draft Initiative deleted."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativesRouter.post(
  "/:initiativeId/publish",
  ...authenticatedWorkspaceWriteMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const initiative = publishInitiative(identity, getInitiativeId(req));

      res.json(createSuccessResponse(initiative, "Initiative published and projected."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativesRouter.post(
  "/:initiativeId/republish",
  ...authenticatedWorkspaceWriteMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const input =
        req.body && typeof req.body === "object" && Object.keys(req.body).length > 0
          ? validateSaveInitiativeDraftInput(req.body)
          : {};
      const initiative = republishInitiative(identity, getInitiativeId(req), input);

      res.json(createSuccessResponse(initiative, "Initiative republished."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativesRouter.post(
  "/:initiativeId/archive",
  ...authenticatedWorkspaceWriteMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const initiative = archiveInitiative(identity, getInitiativeId(req));

      res.json(createSuccessResponse(initiative, "Initiative archived."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

/** Pack 04 — Author closes PUBLIC_CHOICE election (stops voting; starts 72h retention). */
initiativesRouter.post(
  "/:initiativeId/public-choice/close-election",
  ...authenticatedWorkspaceWriteMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const { closePublicChoiceElectionForInitiative } = await import(
        "../initiative-collective-decision/initiative-collective-decision.service.js"
      );
      const decision = await closePublicChoiceElectionForInitiative(
        identity,
        getInitiativeId(req),
      );
      res.json(createSuccessResponse(decision, "Election closed."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

/** Public read — member-visible public projection when eligible. */
initiativesRouter.get("/:initiativeId/public-projection", async (req, res) => {
  const initiative = getInitiativeById(getInitiativeId(req));

  if (!initiative) {
    res.status(404).json(createFailureResponse("Initiative not found."));
    return;
  }

  if (!canExposePublicInitiativeProjection(initiative)) {
    res.status(404).json(createFailureResponse("Public initiative projection is not available."));
    return;
  }

  res.json(
    createSuccessResponse(
      await toPublicInitiativeProjection(initiative),
      "Initiative public projection loaded.",
    ),
  );
});

export default initiativesRouter;
