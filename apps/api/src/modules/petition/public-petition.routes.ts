import { Router } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { getPetition } from "./petition.store.js";
import { toPublicPetitionProjection } from "./public-petition.projection.js";

const publicPetitionRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

publicPetitionRouter.get("/:petitionId", (req, res) => {
  const petitionId = Array.isArray(req.params.petitionId)
    ? req.params.petitionId[0]
    : req.params.petitionId;
  const petition = getPetition(petitionId ?? "");

  if (!petition) {
    res.status(404).json(createFailureResponse("Public Petition not found."));
    return;
  }

  const projection = toPublicPetitionProjection(petition);

  if (!projection) {
    res.status(404).json(createFailureResponse("Public Petition not available."));
    return;
  }

  res.json(createSuccessResponse(projection, "Public petition loaded."));
});

export default publicPetitionRouter;
