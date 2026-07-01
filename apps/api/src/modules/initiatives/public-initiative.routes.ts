import { Router } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { getInitiativeById } from "./initiative.store.js";
import { toPublicInitiativeProjection } from "./public-initiative.projection.js";

const publicInitiativeRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

publicInitiativeRouter.get("/:initiativeId", (req, res) => {
  const initiative = getInitiativeById(req.params.initiativeId);

  if (!initiative) {
    res.status(404).json(createFailureResponse("Initiative not found."));
    return;
  }

  res.json(
    createSuccessResponse(
      toPublicInitiativeProjection(initiative),
      "Public initiative loaded.",
    ),
  );
});

export default publicInitiativeRouter;
