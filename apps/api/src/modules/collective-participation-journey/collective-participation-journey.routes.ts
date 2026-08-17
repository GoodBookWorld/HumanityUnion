import { Router } from "express";

import { authenticationMiddleware } from "../auth/auth.middleware.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";
import {
  buildCollectiveParticipationJourney,
  listCollectiveParticipationJourneySummariesForParticipant,
} from "./collective-participation-journey.service.js";

const collectiveParticipationJourneyRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

/**
 * Workspace-ready: one Initiative journey for the authenticated Participant.
 * Same projection as Experience `participationJourney`.
 */
collectiveParticipationJourneyRouter.get(
  "/me/initiatives/:initiativeId/participation-journey",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const initiativeId = Array.isArray(req.params.initiativeId)
        ? (req.params.initiativeId[0] ?? "")
        : (req.params.initiativeId ?? "");
      const journey = await buildCollectiveParticipationJourney({
        initiativeId,
        participantId: identity.participantId,
      });

      if (!journey) {
        res.status(404).json(createFailureResponse("Initiative not found."));
        return;
      }

      res.json(createSuccessResponse(journey, "Collective participation journey loaded."));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Participation journey request failed.";
      const status = message.includes("not found") ? 404 : message.includes("access") ? 403 : 400;
      res.status(status).json(createFailureResponse(message));
    }
  },
);

/**
 * Workspace readiness — Initiatives where the Participant has ledger history.
 */
collectiveParticipationJourneyRouter.get(
  "/me/participation-journeys",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const summaries = await listCollectiveParticipationJourneySummariesForParticipant(
        identity.participantId,
      );
      res.json(createSuccessResponse(summaries, "Participation journey summaries loaded."));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Participation journey list request failed.";
      res.status(400).json(createFailureResponse(message));
    }
  },
);

export { collectiveParticipationJourneyRouter };
