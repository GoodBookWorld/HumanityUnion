import { Router } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { optionalAuthenticationMiddleware, requireJwtAuthenticationMiddleware } from "../auth/auth.middleware.js";
import { findAuthUserById } from "../auth/auth-user.repository.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { canExposePublicInitiativeProjection } from "../initiatives/public-initiative.projection.js";
import { setInitiativeProposalReaction } from "../initiative-proposal-reactions/initiative-proposal-reaction.service.js";
import {
  getPublicInitiativeImprovementProposalsCollection,
  listPublicInitiativeImprovementProposalsCollections,
} from "./public-initiative-improvement-proposals-stage.projection.js";

const publicInitiativeImprovementProposalsStageRouter = Router();

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

publicInitiativeImprovementProposalsStageRouter.get(
  "/:collectionId",
  optionalAuthenticationMiddleware,
  async (req, res) => {
    const projection = await getPublicInitiativeImprovementProposalsCollection(
      param(req, "collectionId"),
      req.auth?.id ?? null,
    );

    if (!projection) {
      res
        .status(404)
        .json(createFailureResponse("Public Improvement Proposals collection is not available."));
      return;
    }

    res.json(createSuccessResponse(projection, "Public Improvement Proposals collection loaded."));
  },
);

/**
 * Initiative Lifecycle — Part D, Section 9 (Community Reactions). Mirrors
 * the Collaborative Analysis reaction route's auth/eligibility checks
 * exactly (active, verified-email account) — representative statistics
 * only, never a legal vote.
 */
publicInitiativeImprovementProposalsStageRouter.post(
  "/:collectionId/proposals/:proposalId/reactions",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    const userId = req.auth?.id;
    const collectionId = param(req, "collectionId");
    const proposalId = param(req, "proposalId");
    const reactionInput = req.body?.reaction;

    if (!userId) {
      res.status(401).json(createFailureResponse("Authentication required."));
      return;
    }

    const authUser = await findAuthUserById(userId);

    if (!authUser || authUser.status !== "active") {
      res
        .status(403)
        .json(createFailureResponse("Your account is restricted and cannot react to this proposal."));
      return;
    }

    if (authUser.emailVerificationStatus !== "verified") {
      res
        .status(403)
        .json(createFailureResponse("Confirm your email address before reacting to this proposal."));
      return;
    }

    const reaction =
      reactionInput === "support" || reactionInput === "do_not_support" || reactionInput === "none"
        ? reactionInput
        : null;

    if (!reaction) {
      res.status(400).json(createFailureResponse("Reaction must be support, do_not_support, or none."));
      return;
    }

    const projection = await getPublicInitiativeImprovementProposalsCollection(collectionId, userId);

    if (!projection) {
      res
        .status(404)
        .json(createFailureResponse("Public Improvement Proposals collection is not available."));
      return;
    }

    try {
      const currentUserReaction = await setInitiativeProposalReaction({
        initiativeId: projection.initiativeId,
        collectionId,
        proposalId,
        actorUserId: userId,
        reaction,
      });
      const refreshed = await getPublicInitiativeImprovementProposalsCollection(collectionId, userId);
      const proposal = refreshed?.proposals.find((entry) => entry.proposalId === proposalId);

      res.json(
        createSuccessResponse(
          { proposalId, currentUserReaction, reactionSummary: proposal?.reactionSummary },
          "Proposal reaction saved.",
        ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save proposal reaction.";
      const status = message.includes("wait") ? 429 : 400;
      res.status(status).json(createFailureResponse(message));
    }
  },
);

export const publicInitiativeImprovementProposalsStageByInitiativeRouter = Router();

publicInitiativeImprovementProposalsStageByInitiativeRouter.get(
  "/:initiativeId/improvement-proposal-collections",
  optionalAuthenticationMiddleware,
  async (req, res) => {
    const initiativeId = param(req, "initiativeId");
    const initiative = getInitiativeById(initiativeId);

    if (!initiative || !canExposePublicInitiativeProjection(initiative)) {
      res.status(404).json(createFailureResponse("Initiative not found."));
      return;
    }

    const collections = await listPublicInitiativeImprovementProposalsCollections(
      initiativeId,
      req.auth?.id ?? null,
    );

    res.json(createSuccessResponse(collections, "Public Improvement Proposals collections loaded."));
  },
);

export default publicInitiativeImprovementProposalsStageRouter;
