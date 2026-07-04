import { Router } from "express";

import {
  addMilestoneHandler,
  addPhaseHandler,
  archiveImplementationHandler,
  attachEvidenceHandler,
  createImplementationHandler,
  getImplementationByCollectiveDecisionHandler,
  getImplementationByCommitmentHandler,
  getImplementationByInitiativeHandler,
  getImplementationByPetitionHandler,
  getImplementationHandler,
  listImplementationsHandler,
  patchImplementationHandler,
  recordAchievementHandler,
  startImplementationHandler,
  updateMilestoneHandler,
  updatePhaseHandler,
} from "./implementation.controller.js";

const implementationRouter = Router();

implementationRouter.get("/", listImplementationsHandler);
implementationRouter.get("/by-initiative/:initiativeId", getImplementationByInitiativeHandler);
implementationRouter.get(
  "/by-collective-decision/:decisionId",
  getImplementationByCollectiveDecisionHandler,
);
implementationRouter.get("/by-petition/:petitionId", getImplementationByPetitionHandler);
implementationRouter.get("/by-commitment/:commitmentId", getImplementationByCommitmentHandler);
implementationRouter.get("/:implementationId", getImplementationHandler);
implementationRouter.post("/", createImplementationHandler);
implementationRouter.patch("/:implementationId", patchImplementationHandler);
implementationRouter.post("/:implementationId/start", startImplementationHandler);
implementationRouter.post("/:implementationId/phases", addPhaseHandler);
implementationRouter.patch("/:implementationId/phases/:phaseId", updatePhaseHandler);
implementationRouter.post("/:implementationId/milestones", addMilestoneHandler);
implementationRouter.patch("/:implementationId/milestones/:milestoneId", updateMilestoneHandler);
implementationRouter.post("/:implementationId/achievements", recordAchievementHandler);
implementationRouter.post(
  "/:implementationId/achievements/:achievementId/evidence",
  attachEvidenceHandler,
);
implementationRouter.post("/:implementationId/archive", archiveImplementationHandler);

export default implementationRouter;
