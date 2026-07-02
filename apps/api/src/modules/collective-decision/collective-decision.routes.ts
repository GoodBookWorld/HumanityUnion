import { Router } from "express";

import {
  archiveDecisionHandler,
  calculateDecisionResultHandler,
  cancelDecisionHandler,
  closeDecisionHandler,
  completeDecisionHandler,
  createCollectiveDecisionHandler,
  determineOutcomeHandler,
  getCollectiveDecisionHandler,
  listCollectiveDecisionsHandler,
  openDecisionHandler,
  patchCollectiveDecisionHandler,
  scheduleDecisionHandler,
  submitParticipantDecisionHandler,
} from "./collective-decision.controller.js";

const collectiveDecisionRouter = Router();

collectiveDecisionRouter.get("/", listCollectiveDecisionsHandler);
collectiveDecisionRouter.get("/:decisionId", getCollectiveDecisionHandler);
collectiveDecisionRouter.post("/", createCollectiveDecisionHandler);
collectiveDecisionRouter.patch("/:decisionId", patchCollectiveDecisionHandler);
collectiveDecisionRouter.post(
  "/:decisionId/participant-decisions",
  submitParticipantDecisionHandler,
);
collectiveDecisionRouter.post("/:decisionId/calculate-result", calculateDecisionResultHandler);
collectiveDecisionRouter.post("/:decisionId/determine-outcome", determineOutcomeHandler);
collectiveDecisionRouter.post("/:decisionId/schedule", scheduleDecisionHandler);
collectiveDecisionRouter.post("/:decisionId/open", openDecisionHandler);
collectiveDecisionRouter.post("/:decisionId/close", closeDecisionHandler);
collectiveDecisionRouter.post("/:decisionId/complete", completeDecisionHandler);
collectiveDecisionRouter.post("/:decisionId/archive", archiveDecisionHandler);
collectiveDecisionRouter.post("/:decisionId/cancel", cancelDecisionHandler);

export default collectiveDecisionRouter;
