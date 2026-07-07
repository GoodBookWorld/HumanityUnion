import { Router } from "express";

import { authenticationMiddleware } from "../auth/auth.middleware.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";
import { listMyInitiativeImplementationCommitments } from "./initiative-implementation-commitment.service.js";

const initiativeImplementationCommitmentRouter = Router();

initiativeImplementationCommitmentRouter.get("/mine", authenticationMiddleware, (req, res) => {
  const identity = resolveRequestIdentity(req);
  const commitments = listMyInitiativeImplementationCommitments(identity);

  res.json(createSuccessResponse(commitments, "My implementation commitments loaded."));
});

export default initiativeImplementationCommitmentRouter;
