import { Router } from "express";

import {
  archivePetitionHandler,
  closePetitionHandler,
  createPetitionHandler,
  getPetitionByCollectiveDecisionHandler,
  getPetitionByInitiativeHandler,
  getPetitionHandler,
  listPetitionsHandler,
  openPetitionHandler,
  patchPetitionHandler,
  preparePetitionHandler,
  publishPetitionHandler,
  signPetitionHandler,
} from "./petition.controller.js";

const petitionRouter = Router();

petitionRouter.get("/", listPetitionsHandler);
petitionRouter.get(
  "/by-collective-decision/:collectiveDecisionId",
  getPetitionByCollectiveDecisionHandler,
);
petitionRouter.get("/by-initiative/:initiativeId", getPetitionByInitiativeHandler);
petitionRouter.get("/:petitionId", getPetitionHandler);
petitionRouter.post("/", createPetitionHandler);
petitionRouter.patch("/:petitionId", patchPetitionHandler);
petitionRouter.post("/:petitionId/prepare", preparePetitionHandler);
petitionRouter.post("/:petitionId/publish", publishPetitionHandler);
petitionRouter.post("/:petitionId/open", openPetitionHandler);
petitionRouter.post("/:petitionId/signatures", signPetitionHandler);
petitionRouter.post("/:petitionId/close", closePetitionHandler);
petitionRouter.post("/:petitionId/archive", archivePetitionHandler);

export default petitionRouter;
