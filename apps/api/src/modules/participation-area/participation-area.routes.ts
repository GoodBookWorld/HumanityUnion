import { Router, type Request, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { authenticationMiddleware } from "../auth/auth.middleware.js";
import { AuthenticationRequiredError } from "../auth/auth.errors.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";
import {
  BOOTSTRAP_GEOGRAPHY_COUNTRIES,
  BOOTSTRAP_GEOGRAPHY_REGIONS,
} from "./participation-area-geography.js";
import {
  ParticipationAreaConflictError,
  ParticipationAreaNotFoundError,
  ParticipationAreaValidationError,
} from "./participation-area.errors.js";
import {
  cancelParticipationAreaChangeForParticipant,
  createInitialParticipationAreaForParticipant,
  loadParticipationAreaWorkspaceForParticipant,
  PARTICIPATION_AREA_TRANSITION_DELAY_DAYS,
  requestParticipationAreaChangeForParticipant,
} from "./participation-area.service.js";

const participationAreaRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

function resolveRouteErrorStatus(error: unknown): number {
  if (error instanceof ParticipationAreaValidationError) {
    return 400;
  }

  if (error instanceof ParticipationAreaConflictError) {
    return 409;
  }

  if (error instanceof ParticipationAreaNotFoundError) {
    return 404;
  }

  if (error instanceof AuthenticationRequiredError) {
    return 401;
  }

  return 500;
}

function handleRouteError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "Participation Area request failed.";
  res.status(resolveRouteErrorStatus(error)).json(createFailureResponse(message));
}

async function resolveAuthenticatedContext(req: Request): Promise<{
  participantId: string;
  userId: string;
}> {
  const identity = await resolveRequestIdentity(req);

  if (!req.auth?.id) {
    throw new AuthenticationRequiredError();
  }

  return {
    participantId: identity.participantId,
    userId: req.auth.id,
  };
}

participationAreaRouter.get("/me", authenticationMiddleware, async (req, res) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    const state = await loadParticipationAreaWorkspaceForParticipant(context);

    res.json(
      createSuccessResponse(
        {
          ...state,
          transitionPolicy: {
            delayDays: PARTICIPATION_AREA_TRANSITION_DELAY_DAYS,
            explanation: "Your current area remains active until the change becomes effective.",
          },
          geographyOptions: {
            countries: BOOTSTRAP_GEOGRAPHY_COUNTRIES,
            regions: BOOTSTRAP_GEOGRAPHY_REGIONS,
          },
        },
        "Participation Area workspace loaded.",
      ),
    );
  } catch (error) {
    handleRouteError(res, error);
  }
});

participationAreaRouter.post("/me", authenticationMiddleware, async (req, res) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    const state = await createInitialParticipationAreaForParticipant({
      ...context,
      body: req.body,
    });

    res.status(201).json(createSuccessResponse(state, "Participation Area created."));
  } catch (error) {
    handleRouteError(res, error);
  }
});

participationAreaRouter.post("/me/transition", authenticationMiddleware, async (req, res) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    const state = await requestParticipationAreaChangeForParticipant({
      ...context,
      body: req.body,
    });

    res.status(201).json(createSuccessResponse(state, "Participation Area transition requested."));
  } catch (error) {
    handleRouteError(res, error);
  }
});

participationAreaRouter.post(
  "/me/transition/cancel",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const context = await resolveAuthenticatedContext(req);
      const state = await cancelParticipationAreaChangeForParticipant(context);

      res.json(createSuccessResponse(state, "Participation Area transition cancelled."));
    } catch (error) {
      handleRouteError(res, error);
    }
  },
);

export default participationAreaRouter;
