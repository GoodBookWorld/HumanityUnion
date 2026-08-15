import { Router } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { requireJwtAuthenticationMiddleware } from "../auth/auth.middleware.js";
import { findAuthUserById } from "../auth/auth-user.repository.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { canExposePublicInitiativeProjection } from "../initiatives/public-initiative.projection.js";
import { setInitiativeRevisionReaction } from "../initiative-revision-reactions/index.js";
import { createInitialInitiativeVersionRevision } from "./initiative-version-revision.service.js";
import {
  getPublicInitiativeVersionHistory,
  getPublicInitiativeVersionRevision,
} from "./public-initiative-version-revision.projection.js";

export const publicInitiativeVersionRevisionRouter = Router();

function param(req: { params: Record<string, string | string[] | undefined> }, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

publicInitiativeVersionRevisionRouter.get("/:initiativeId/revisions", async (req, res) => {
  const initiative = getInitiativeById(req.params.initiativeId);

  if (!initiative) {
    res.status(404).json(createFailureResponse("Initiative not found."));
    return;
  }

  if (!canExposePublicInitiativeProjection(initiative)) {
    res.status(404).json(createFailureResponse("Initiative not found."));
    return;
  }

  createInitialInitiativeVersionRevision(initiative, initiative.stewardId);
  const history = await getPublicInitiativeVersionHistory(req.params.initiativeId);

  res.json(createSuccessResponse(history, "Public initiative version history loaded."));
});

publicInitiativeVersionRevisionRouter.get("/:initiativeId/revisions/:version", async (req, res) => {
  const initiative = getInitiativeById(req.params.initiativeId);

  if (!initiative) {
    res.status(404).json(createFailureResponse("Initiative not found."));
    return;
  }

  if (!canExposePublicInitiativeProjection(initiative)) {
    res.status(404).json(createFailureResponse("Initiative not found."));
    return;
  }

  const version = Number.parseInt(req.params.version, 10);

  if (!Number.isFinite(version) || version < 1) {
    res.status(400).json(createFailureResponse("Version must be a positive integer."));
    return;
  }

  createInitialInitiativeVersionRevision(initiative, initiative.stewardId);
  const revision = await getPublicInitiativeVersionRevision(
    req.params.initiativeId,
    version,
    req.auth?.id ?? null,
  );

  if (!revision) {
    res.status(404).json(createFailureResponse("Initiative version revision not found."));
    return;
  }

  res.json(createSuccessResponse(revision, "Public initiative version revision loaded."));
});

/**
 * Initiative Lifecycle — Part E, Section 9 (Community Reactions). Mirrors
 * the Improvement Proposals reaction route's auth/eligibility checks
 * exactly (active, verified-email account) — representative statistics
 * only, never a legal vote.
 */
publicInitiativeVersionRevisionRouter.post(
  "/:initiativeId/revisions/:version/reactions",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    const userId = req.auth?.id;

    if (!userId) {
      res.status(401).json(createFailureResponse("Authentication required."));
      return;
    }

    const initiativeId = param(req, "initiativeId");
    const initiative = getInitiativeById(initiativeId);

    if (!initiative || !canExposePublicInitiativeProjection(initiative)) {
      res.status(404).json(createFailureResponse("Initiative not found."));
      return;
    }

    const version = Number.parseInt(param(req, "version"), 10);

    if (!Number.isFinite(version) || version < 1) {
      res.status(400).json(createFailureResponse("Version must be a positive integer."));
      return;
    }

    const authUser = await findAuthUserById(userId);

    if (!authUser || authUser.status !== "active") {
      res
        .status(403)
        .json(createFailureResponse("Your account is restricted and cannot react to this revision."));
      return;
    }

    if (authUser.emailVerificationStatus !== "verified") {
      res
        .status(403)
        .json(createFailureResponse("Confirm your email address before reacting to this revision."));
      return;
    }

    const reactionInput = req.body?.reaction;
    const reaction =
      reactionInput === "support" || reactionInput === "do_not_support" || reactionInput === "none"
        ? reactionInput
        : null;

    if (!reaction) {
      res.status(400).json(createFailureResponse("Reaction must be support, do_not_support, or none."));
      return;
    }

    try {
      const currentUserReaction = await setInitiativeRevisionReaction({
        initiativeId,
        version,
        actorUserId: userId,
        reaction,
      });
      const refreshed = await getPublicInitiativeVersionRevision(initiativeId, version, userId);

      res.json(
        createSuccessResponse(
          { currentUserReaction, reactionSummary: refreshed?.reactionSummary },
          "Revision reaction saved.",
        ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save revision reaction.";
      const status = message.includes("wait") ? 429 : 400;
      res.status(status).json(createFailureResponse(message));
    }
  },
);

export default publicInitiativeVersionRevisionRouter;
