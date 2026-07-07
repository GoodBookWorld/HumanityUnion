import { Router } from "express";

import { authenticationMiddleware } from "../auth/auth.middleware.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";
import {
  listMyInitiativeImplementationTrackingUpdates,
  listMyInitiativeImplementationTrackings,
} from "./initiative-implementation-tracking.service.js";

const initiativeImplementationTrackingRouter = Router();

initiativeImplementationTrackingRouter.get("/mine", authenticationMiddleware, (req, res) => {
  const identity = resolveRequestIdentity(req);
  const trackings = listMyInitiativeImplementationTrackings(identity);
  const updates = listMyInitiativeImplementationTrackingUpdates(identity);

  res.json(
    createSuccessResponse(trackings, "My implementation tracking loaded.", {
      updates,
    }),
  );
});

export default initiativeImplementationTrackingRouter;
