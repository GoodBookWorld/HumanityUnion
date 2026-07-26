import { Router } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { optionalAuthenticationMiddleware } from "../auth/auth.middleware.js";
import {
  MemberProfileAccessDeniedError,
  MemberProfileNotFoundError,
  MemberProfilePersistenceUnavailableError,
} from "./member-profile.errors.js";
import { getPublicMemberProfileById } from "./member-profile.service.js";

const publicMemberProfileRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

function resolvePublicMemberProfileErrorStatus(error: unknown): number {
  if (error instanceof MemberProfileNotFoundError) {
    return 404;
  }

  if (error instanceof MemberProfileAccessDeniedError) {
    return 403;
  }

  if (error instanceof MemberProfilePersistenceUnavailableError) {
    return 503;
  }

  return 500;
}

publicMemberProfileRouter.get("/:profileId", optionalAuthenticationMiddleware, async (req, res) => {
  const profileId = Array.isArray(req.params.profileId)
    ? (req.params.profileId[0] ?? "")
    : (req.params.profileId ?? "");

  const viewerIsAuthenticated = Boolean(req.auth?.memberId);
  const viewerUserId = req.auth?.id;

  try {
    const profile = await getPublicMemberProfileById(profileId, {
      viewerIsAuthenticated,
      viewerUserId,
    });

    res.json(createSuccessResponse(profile, "Public member profile loaded."));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Public member profile request failed.";
    res.status(resolvePublicMemberProfileErrorStatus(error)).json(createFailureResponse(message));
  }
});

export default publicMemberProfileRouter;
