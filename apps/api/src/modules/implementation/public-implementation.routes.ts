import { Router } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { getImplementation } from "./implementation.store.js";
import { toPublicImplementationProjection } from "./public-implementation.projection.js";

const publicImplementationRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

publicImplementationRouter.get("/:implementationId", (req, res) => {
  const implementationId = Array.isArray(req.params.implementationId)
    ? req.params.implementationId[0]
    : req.params.implementationId;
  const implementation = getImplementation(implementationId ?? "");

  if (!implementation) {
    res.status(404).json(createFailureResponse("Public Implementation not found."));
    return;
  }

  const projection = toPublicImplementationProjection(implementation);

  if (!projection) {
    res.status(404).json(createFailureResponse("Public Implementation not available."));
    return;
  }

  res.json(createSuccessResponse(projection, "Public implementation loaded."));
});

export default publicImplementationRouter;
