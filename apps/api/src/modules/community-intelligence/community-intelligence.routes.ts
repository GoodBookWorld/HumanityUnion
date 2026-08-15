import { Router, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { requireJwtAuthenticationMiddleware } from "../auth/auth.middleware.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";

import { CommunityIntelligenceError } from "./community-intelligence.errors.js";
import {
  buildCollaborationOpportunitiesForInitiative,
  buildWorkspaceCommunityOpportunities,
  checkDraftSimilarity,
  findRelatedInitiativesForInitiative,
  findRelevantParticipantsForInitiative,
} from "./community-intelligence.service.js";
import { parseSimilarityCheckBody } from "./community-intelligence.validators.js";

function resolveParam(value: string | string[]): string {
  return Array.isArray(value) ? (value[0] ?? "") : value;
}

function createFailureResponse(message: string) {
  return {
    success: false as const,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

function handleError(res: Response, error: unknown): void {
  if (error instanceof CommunityIntelligenceError) {
    res.status(error.statusCode).json(createFailureResponse(error.message));
    return;
  }

  console.error("[community-intelligence]", error);
  res
    .status(500)
    .json(createFailureResponse("Community Intelligence is temporarily unavailable."));
}

export const publicCommunityIntelligenceRouter = Router();
export const communityIntelligenceRouter = Router();

/** Public: Related Initiatives (non-personalized). */
publicCommunityIntelligenceRouter.get(
  "/community-intelligence/initiatives/:initiativeId/related",
  async (req, res) => {
    try {
      const initiativeId = resolveParam(req.params.initiativeId);
      const result = await findRelatedInitiativesForInitiative(initiativeId);
      res.status(200).json(createSuccessResponse(result, "Related Initiatives loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

communityIntelligenceRouter.use(requireJwtAuthenticationMiddleware);

/** Authenticated: draft / pre-publish similarity check (never blocks). */
communityIntelligenceRouter.post("/similarity-check", async (req, res) => {
  try {
    const body = parseSimilarityCheckBody(req.body);
    const result = await checkDraftSimilarity(body);
    res.status(200).json(createSuccessResponse(result, "Similarity check completed."));
  } catch (error) {
    handleError(res, error);
  }
});

/** Authenticated: Workspace Collaboration Opportunities. */
communityIntelligenceRouter.get("/workspace-opportunities", async (req, res) => {
  try {
    const identity = await resolveRequestIdentity(req);
    const result = await buildWorkspaceCommunityOpportunities({
      participantId: identity.participantId,
      memberId: identity.participantId,
    });
    res
      .status(200)
      .json(createSuccessResponse(result, "Collaboration opportunities loaded."));
  } catch (error) {
    handleError(res, error);
  }
});

/** Authenticated: collaboration opportunities for one Initiative. */
communityIntelligenceRouter.get("/initiatives/:initiativeId/collaboration", async (req, res) => {
  try {
    const initiativeId = resolveParam(req.params.initiativeId);
    const items = await buildCollaborationOpportunitiesForInitiative(initiativeId);
    res.status(200).json(
      createSuccessResponse(
        {
          initiativeId,
          items,
          emptyMessage:
            items.length === 0
              ? "No collaboration opportunities are available yet."
              : "Collaboration opportunities for this Initiative.",
          generatedAt: new Date().toISOString(),
        },
        "Collaboration opportunities loaded.",
      ),
    );
  } catch (error) {
    handleError(res, error);
  }
});

/** Authenticated: relevant public Participants (never worth rankings). */
communityIntelligenceRouter.get(
  "/initiatives/:initiativeId/relevant-participants",
  async (req, res) => {
    try {
      const initiativeId = resolveParam(req.params.initiativeId);
      const items = await findRelevantParticipantsForInitiative(initiativeId, {
        viewerIsAuthenticated: true,
      });
      res.status(200).json(
        createSuccessResponse(
          {
            initiativeId,
            items,
            emptyMessage:
              items.length === 0
                ? "No collaboration opportunities are available yet."
                : "Participants who may be relevant for this Initiative’s work.",
            generatedAt: new Date().toISOString(),
          },
          "Relevant Participants loaded.",
        ),
      );
    } catch (error) {
      handleError(res, error);
    }
  },
);
