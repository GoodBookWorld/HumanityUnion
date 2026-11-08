import { Router } from "express";

import {
  authenticationMiddleware,
  requireJwtAuthenticationMiddleware,
} from "../auth/auth.middleware.js";
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
// HU-LC-05B — administrative mutations need a verified access token (never the
// bootstrap identity) and stewardship of the Petition's Initiative (controller).
petitionRouter.post("/", requireJwtAuthenticationMiddleware, createPetitionHandler);
petitionRouter.patch("/:petitionId", requireJwtAuthenticationMiddleware, patchPetitionHandler);
petitionRouter.post(
  "/:petitionId/prepare",
  requireJwtAuthenticationMiddleware,
  preparePetitionHandler,
);
petitionRouter.post(
  "/:petitionId/publish",
  requireJwtAuthenticationMiddleware,
  publishPetitionHandler,
);
petitionRouter.post("/:petitionId/open", requireJwtAuthenticationMiddleware, openPetitionHandler);
// Initiative Lifecycle — Part F, Section 7/8 (Representative Signatures /
// "Withdraw Signature"). Both routes need `req.auth` decoded from a real
// JWT when the caller sends one, so the handler's `resolveRequestIdentity`
// fallback (used whenever the body omits `participantId`) resolves the
// real signed-in actor instead of only ever falling through to the dev
// bootstrap identity — matching how `initiative-petition-lifecycle.routes.ts`
// gates its own owned Author actions. A body-supplied `participantId` on
// `/signatures` must equal that signed-in Participant (HU-LC-05B).
petitionRouter.post("/:petitionId/signatures", authenticationMiddleware, signPetitionHandler);
petitionRouter.post(
  "/:petitionId/signatures/withdraw",
  authenticationMiddleware,
  withdrawPetitionSignatureHandler,
);
petitionRouter.post("/:petitionId/close", requireJwtAuthenticationMiddleware, closePetitionHandler);
petitionRouter.post(
  "/:petitionId/archive",
  requireJwtAuthenticationMiddleware,
  archivePetitionHandler,
);

export default petitionRouter;
