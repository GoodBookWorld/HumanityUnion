import { Router } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { optionalAuthenticationMiddleware } from "../auth/auth.middleware.js";
import { isInitiativeLifecycleStageId } from "@hu/types";
import { getInitiativeById } from "./initiative.store.js";
import { canExposePublicInitiativeProjection } from "./public-initiative.projection.js";
import { buildInitiativeLifecycleStageProjection } from "./initiative-lifecycle-stage-projection.service.js";

/**
 * Initiative Lifecycle — Part A Completion Part 2: the selected-stage
 * projection route. Mounted alongside `public-initiative-experience.routes`
 * — same public-initiatives prefix, same optional-auth pattern, same
 * "not found" gating — but this endpoint answers exactly one stage per
 * request instead of loading all twelve (Part 17 performance rule).
 */
export const initiativeLifecycleStageProjectionRouter = Router();

function resolveParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

initiativeLifecycleStageProjectionRouter.get(
  "/:initiativeId/lifecycle-stage/:stageId",
  optionalAuthenticationMiddleware,
  async (req, res) => {
    const initiativeId = resolveParam(req.params.initiativeId);
    const stageId = resolveParam(req.params.stageId);

    if (!isInitiativeLifecycleStageId(stageId)) {
      res.status(404).json(createFailureResponse("Lifecycle stage not found."));
      return;
    }

    // One Initiative lookup for the entire request.
    const initiative = getInitiativeById(initiativeId);

    if (!initiative || !canExposePublicInitiativeProjection(initiative)) {
      res.status(404).json(createFailureResponse("Initiative not found."));
      return;
    }

    const projection = await buildInitiativeLifecycleStageProjection({
      initiative,
      stageId,
      viewerParticipantId: req.auth?.memberId ?? null,
    });

    if (!projection) {
      res.status(404).json(createFailureResponse("Lifecycle stage not found."));
      return;
    }

    res.json(createSuccessResponse(projection, "Initiative lifecycle stage loaded."));
  },
);

export default initiativeLifecycleStageProjectionRouter;
