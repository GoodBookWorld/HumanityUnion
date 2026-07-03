import { Router } from "express";

import {
  activateImplementationCommitmentHandler,
  addContributionItemHandler,
  archiveImplementationCommitmentHandler,
  completeImplementationCommitmentHandler,
  createImplementationCommitmentHandler,
  getImplementationCommitmentByCollectiveDecisionHandler,
  getImplementationCommitmentByInitiativeHandler,
  getImplementationCommitmentByPetitionHandler,
  getImplementationCommitmentHandler,
  listImplementationCommitmentsHandler,
  patchImplementationCommitmentHandler,
  submitImplementationCommitmentHandler,
  updateContributionProfileHandler,
  withdrawContributionItemHandler,
  withdrawImplementationCommitmentHandler,
} from "./implementation-commitment.controller.js";

const implementationCommitmentRouter = Router();

implementationCommitmentRouter.get("/", listImplementationCommitmentsHandler);
implementationCommitmentRouter.get(
  "/by-initiative/:initiativeId",
  getImplementationCommitmentByInitiativeHandler,
);
implementationCommitmentRouter.get(
  "/by-collective-decision/:decisionId",
  getImplementationCommitmentByCollectiveDecisionHandler,
);
implementationCommitmentRouter.get(
  "/by-petition/:petitionId",
  getImplementationCommitmentByPetitionHandler,
);
implementationCommitmentRouter.get("/:commitmentId", getImplementationCommitmentHandler);
implementationCommitmentRouter.post("/", createImplementationCommitmentHandler);
implementationCommitmentRouter.patch("/:commitmentId", patchImplementationCommitmentHandler);
implementationCommitmentRouter.post("/:commitmentId/submit", submitImplementationCommitmentHandler);
implementationCommitmentRouter.post(
  "/:commitmentId/activate",
  activateImplementationCommitmentHandler,
);
implementationCommitmentRouter.post(
  "/:commitmentId/contribution-profile",
  updateContributionProfileHandler,
);
implementationCommitmentRouter.post(
  "/:commitmentId/contribution-items",
  addContributionItemHandler,
);
implementationCommitmentRouter.post(
  "/:commitmentId/contribution-items/:itemId/withdraw",
  withdrawContributionItemHandler,
);
implementationCommitmentRouter.post("/:commitmentId/withdraw", withdrawImplementationCommitmentHandler);
implementationCommitmentRouter.post("/:commitmentId/complete", completeImplementationCommitmentHandler);
implementationCommitmentRouter.post("/:commitmentId/archive", archiveImplementationCommitmentHandler);

export default implementationCommitmentRouter;
