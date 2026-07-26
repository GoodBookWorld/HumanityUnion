import { Router } from "express";

import { createSuccessResponse } from "../../../shared/http-response.js";
import {
  requireJwtAuthenticationMiddleware,
} from "../../auth/auth.middleware.js";
import { requireVerifiedEmailForMutationsMiddleware } from "../../auth/auth-workspace-gate.js";
import { createActivity } from "../application/create-activity.service.js";
import { getActivityByIdForMember } from "../application/activity-query.service.js";
import {
  ActivityForbiddenError,
  ActivityMemberNotRegisteredError,
  ActivityNotFoundError,
  ActivityPersistenceError,
  ActivityTransactionError,
  ActivityValidationError,
} from "../domain/activity.errors.js";
import {
  assertNoTrustedCreateActivityFields,
  validateCreateActivityInput,
} from "../domain/activity.validation.js";

const activityRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

activityRouter.post(
  "/",
  requireJwtAuthenticationMiddleware,
  requireVerifiedEmailForMutationsMiddleware,
  async (req, res) => {
    if (!req.auth?.memberId) {
      res.status(403).json(createFailureResponse("Registered Member is required to create an Activity."));
      return;
    }

    const body = req.body as Record<string, unknown>;

    try {
      assertNoTrustedCreateActivityFields(body);
      const command = validateCreateActivityInput(body);

      const result = await createActivity({
        creatorMemberId: req.auth.memberId,
        actorId: req.auth.id,
        command,
      });

      res.status(201).json(createSuccessResponse(result.activity, "Activity created."));
    } catch (error) {
      if (error instanceof ActivityValidationError) {
        res.status(400).json(createFailureResponse(error.message));
        return;
      }

      if (error instanceof ActivityMemberNotRegisteredError) {
        res.status(403).json(createFailureResponse(error.message));
        return;
      }

      if (error instanceof ActivityTransactionError || error instanceof ActivityPersistenceError) {
        res.status(500).json(createFailureResponse(error.message));
        return;
      }

      const message = error instanceof Error ? error.message : "Activity creation failed.";
      res.status(500).json(createFailureResponse(message));
    }
  },
);

activityRouter.get("/:activityId", requireJwtAuthenticationMiddleware, async (req, res) => {
  if (!req.auth?.memberId) {
    res.status(401).json(createFailureResponse("Authentication required."));
    return;
  }

  const activityId = req.params.activityId;

  if (!activityId || Array.isArray(activityId)) {
    res.status(400).json(createFailureResponse("Activity identifier is required."));
    return;
  }

  try {
    const activity = await getActivityByIdForMember({
      activityId,
      memberId: req.auth.memberId,
    });

    res.json(createSuccessResponse(activity, "Activity loaded."));
  } catch (error) {
    if (error instanceof ActivityNotFoundError) {
      res.status(404).json(createFailureResponse(error.message));
      return;
    }

    if (error instanceof ActivityForbiddenError) {
      res.status(403).json(createFailureResponse(error.message));
      return;
    }

    const message = error instanceof Error ? error.message : "Activity request failed.";
    res.status(500).json(createFailureResponse(message));
  }
});

export default activityRouter;
