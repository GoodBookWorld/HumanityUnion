import { Router } from "express";

import { authenticationMiddleware } from "../auth/auth.middleware.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";
import { listMyInitiativePublicImpacts } from "./initiative-public-impact.service.js";

const initiativePublicImpactRouter = Router();

initiativePublicImpactRouter.get("/mine", authenticationMiddleware, (req, res) => {
  const identity = resolveRequestIdentity(req);
  const impacts = listMyInitiativePublicImpacts(identity);

  res.json(createSuccessResponse(impacts, "My public impact records loaded."));
});

export default initiativePublicImpactRouter;
