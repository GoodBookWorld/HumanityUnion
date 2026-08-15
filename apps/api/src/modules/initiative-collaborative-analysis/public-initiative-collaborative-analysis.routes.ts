import { Router } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { optionalAuthenticationMiddleware, requireJwtAuthenticationMiddleware } from "../auth/auth.middleware.js";
import { findAuthUserById } from "../auth/auth-user.repository.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { canExposePublicInitiativeProjection } from "../initiatives/public-initiative.projection.js";
import { setInitiativeAnalysisReaction } from "../initiative-analysis-reactions/index.js";
import {
  getPublicInitiativeCollaborativeAnalysis,
  listPublicInitiativeCollaborativeAnalyses,
} from "./public-initiative-collaborative-analysis.projection.js";

const publicInitiativeCollaborativeAnalysisRouter = Router();

function getAnalysisId(req: { params: Record<string, string | string[] | undefined> }): string {
  const analysisId = req.params.analysisId;
  return Array.isArray(analysisId) ? (analysisId[0] ?? "") : (analysisId ?? "");
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

publicInitiativeCollaborativeAnalysisRouter.get(
  "/:analysisId",
  optionalAuthenticationMiddleware,
  async (req, res) => {
    const projection = await getPublicInitiativeCollaborativeAnalysis(
      getAnalysisId(req),
      req.auth?.id ?? null,
    );

    if (!projection) {
      res.status(404).json(createFailureResponse("Public initiative analysis is not available."));
      return;
    }

    res.json(createSuccessResponse(projection, "Public initiative analysis loaded."));
  },
);

/**
 * Initiative Lifecycle — Part B, Section 9 (Reaction Model). Mirrors the
 * comment-reaction route's auth/eligibility checks exactly (active,
 * verified-email account) — Support / Do Not Support on a published
 * Analysis is "representative statistics only, not a legal vote", so it
 * uses the same participant-only scope as comment reactions rather than
 * Initiative Support's separate anonymous-visitor path (a deliberate,
 * documented scope decision — see Part B completion report).
 */
publicInitiativeCollaborativeAnalysisRouter.post(
  "/:analysisId/reactions",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    const userId = req.auth?.id;
    const analysisId = getAnalysisId(req);
    const reactionInput = req.body?.reaction;

    if (!userId) {
      res.status(401).json(createFailureResponse("Authentication required."));
      return;
    }

    const authUser = await findAuthUserById(userId);

    if (!authUser || authUser.status !== "active") {
      res
        .status(403)
        .json(createFailureResponse("Your account is restricted and cannot react to this analysis."));
      return;
    }

    if (authUser.emailVerificationStatus !== "verified") {
      res
        .status(403)
        .json(createFailureResponse("Confirm your email address before reacting to this analysis."));
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

    const projection = await getPublicInitiativeCollaborativeAnalysis(analysisId, userId);

    if (!projection) {
      res.status(404).json(createFailureResponse("Public initiative analysis is not available."));
      return;
    }

    try {
      const currentUserReaction = await setInitiativeAnalysisReaction({
        initiativeId: projection.initiativeId,
        analysisId,
        actorUserId: userId,
        reaction,
      });
      const reactionSummary = await getPublicInitiativeCollaborativeAnalysis(analysisId, userId);

      res.json(
        createSuccessResponse(
          { analysisId, currentUserReaction, reactionSummary: reactionSummary?.reactionSummary },
          "Analysis reaction saved.",
        ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save analysis reaction.";
      const status = message.includes("wait") ? 429 : 400;
      res.status(status).json(createFailureResponse(message));
    }
  },
);

export const publicInitiativeCollaborativeAnalysesByInitiativeRouter = Router();

publicInitiativeCollaborativeAnalysesByInitiativeRouter.get(
  "/:initiativeId/analyses",
  async (req, res) => {
    const initiative = getInitiativeById(req.params.initiativeId);

    if (!initiative) {
      res.status(404).json(createFailureResponse("Initiative not found."));
      return;
    }

    if (!canExposePublicInitiativeProjection(initiative)) {
      res.status(404).json(createFailureResponse("Initiative not found."));
      return;
    }

    const analyses = await listPublicInitiativeCollaborativeAnalyses(req.params.initiativeId);

    res.json(createSuccessResponse(analyses, "Public initiative analyses loaded."));
  },
);

export default publicInitiativeCollaborativeAnalysisRouter;
