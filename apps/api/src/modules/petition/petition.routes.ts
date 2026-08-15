import { Router } from "express";

import { authenticationMiddleware } from "../auth/auth.middleware.js";
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
  withdrawPetitionSignatureHandler,
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
// Initiative Lifecycle — Part F, Section 7/8 (Representative Signatures /
// "Withdraw Signature"). Both routes need `req.auth` decoded from a real
// JWT when the caller sends one, so the handler's `resolveRequestIdentity`
// fallback (used whenever the body omits `participantId`) resolves the
// real signed-in actor instead of only ever falling through to the dev
// bootstrap identity — matching how `initiative-petition-lifecycle.routes.ts`
// gates its own owned Author actions. The legacy body-supplied
// `participantId` contract on `/signatures` keeps working unchanged.
petitionRouter.post("/:petitionId/signatures", authenticationMiddleware, signPetitionHandler);
petitionRouter.post(
  "/:petitionId/signatures/withdraw",
  authenticationMiddleware,
  withdrawPetitionSignatureHandler,
);
petitionRouter.post("/:petitionId/close", closePetitionHandler);
petitionRouter.post("/:petitionId/archive", archivePetitionHandler);

export default petitionRouter;
