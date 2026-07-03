import { Router } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { getImplementationCommitment } from "./implementation-commitment.store.js";
import { toPublicImplementationCommitmentProjection } from "./public-implementation-commitment.projection.js";

const publicImplementationCommitmentRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

publicImplementationCommitmentRouter.get("/:commitmentId", (req, res) => {
  const commitmentId = Array.isArray(req.params.commitmentId)
    ? req.params.commitmentId[0]
    : req.params.commitmentId;
  const commitment = getImplementationCommitment(commitmentId ?? "");

  if (!commitment) {
    res.status(404).json(createFailureResponse("Public Implementation Commitment not found."));
    return;
  }

  const projection = toPublicImplementationCommitmentProjection(commitment);

  if (!projection) {
    res.status(404).json(createFailureResponse("Public Implementation Commitment not available."));
    return;
  }

  res.json(createSuccessResponse(projection, "Public implementation commitment loaded."));
});

export default publicImplementationCommitmentRouter;
