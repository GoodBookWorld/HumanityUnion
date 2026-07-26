import { Router, type Request, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { authenticatedWorkspaceWriteMiddleware } from "../auth/auth-workspace-gate.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";
import { getMemberById } from "../member/member-access.js";
import { loadParticipationAreaWorkspaceForParticipant } from "../participation-area/participation-area.service.js";
import {
  MemberProfileAccessDeniedError,
  MemberProfileNotFoundError,
  MemberProfilePersistenceUnavailableError,
  MemberProfileValidationError,
} from "./member-profile.errors.js";
import {
  getMemberProfilePrivacyForUser,
  getOrCreateMemberProfileForUser,
  getWorkspaceMemberIdentityForUser,
  updateMemberProfileForUser,
  updateMemberProfilePrivacyForUser,
} from "./member-profile.service.js";

const memberProfileRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

function resolveMemberProfileErrorStatus(error: unknown): number {
  if (error instanceof MemberProfileValidationError) {
    return 400;
  }

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

function handleMemberProfileError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "Member profile request failed.";
  res.status(resolveMemberProfileErrorStatus(error)).json(createFailureResponse(message));
}

function resolveAuthUserId(req: Request): string | null {
  if (!req.auth?.id) {
    return null;
  }

  return req.auth.id;
}

async function resolveDisplayName(req: Request): Promise<string> {
  const member = req.auth?.memberId ? await getMemberById(req.auth.memberId) : null;
  return member?.profile.displayName ?? req.auth?.email.split("@")[0] ?? "Member";
}

memberProfileRouter.get("/me", ...authenticatedWorkspaceWriteMiddleware, async (req, res) => {
  const userId = resolveAuthUserId(req);

  if (!userId) {
    res.status(401).json(createFailureResponse("Authentication required."));
    return;
  }

  try {
    const profile = await getOrCreateMemberProfileForUser({
      userId,
      displayName: await resolveDisplayName(req),
    });

    res.json(createSuccessResponse(profile, "Member profile loaded."));
  } catch (error) {
    handleMemberProfileError(res, error);
  }
});

memberProfileRouter.patch("/me", ...authenticatedWorkspaceWriteMiddleware, async (req, res) => {
  const userId = resolveAuthUserId(req);

  if (!userId) {
    res.status(401).json(createFailureResponse("Authentication required."));
    return;
  }

  try {
    await getOrCreateMemberProfileForUser({
      userId,
      displayName: await resolveDisplayName(req),
    });

    const profile = await updateMemberProfileForUser(userId, req.body);
    res.json(createSuccessResponse(profile, "Member profile updated."));
  } catch (error) {
    handleMemberProfileError(res, error);
  }
});

memberProfileRouter.get(
  "/me/privacy",
  ...authenticatedWorkspaceWriteMiddleware,
  async (req, res) => {
    const userId = resolveAuthUserId(req);

    if (!userId) {
      res.status(401).json(createFailureResponse("Authentication required."));
      return;
    }

    try {
      await getOrCreateMemberProfileForUser({
        userId,
        displayName: await resolveDisplayName(req),
      });

      const privacy = await getMemberProfilePrivacyForUser(userId);
      res.json(createSuccessResponse(privacy, "Member profile privacy loaded."));
    } catch (error) {
      handleMemberProfileError(res, error);
    }
  },
);

memberProfileRouter.patch(
  "/me/privacy",
  ...authenticatedWorkspaceWriteMiddleware,
  async (req, res) => {
    const userId = resolveAuthUserId(req);

    if (!userId) {
      res.status(401).json(createFailureResponse("Authentication required."));
      return;
    }

    try {
      await getOrCreateMemberProfileForUser({
        userId,
        displayName: await resolveDisplayName(req),
      });

      const privacy = await updateMemberProfilePrivacyForUser(userId, req.body);
      res.json(createSuccessResponse(privacy, "Member profile privacy updated."));
    } catch (error) {
      handleMemberProfileError(res, error);
    }
  },
);

memberProfileRouter.get(
  "/me/workspace-identity",
  ...authenticatedWorkspaceWriteMiddleware,
  async (req, res) => {
    const userId = resolveAuthUserId(req);

    if (!userId) {
      res.status(401).json(createFailureResponse("Authentication required."));
      return;
    }

    try {
      await getOrCreateMemberProfileForUser({
        userId,
        displayName: await resolveDisplayName(req),
      });

      const requestIdentity = await resolveRequestIdentity(req);
      await loadParticipationAreaWorkspaceForParticipant({
        participantId: requestIdentity.participantId,
        userId,
      });

      const identity = await getWorkspaceMemberIdentityForUser(userId);
      res.json(createSuccessResponse(identity, "Workspace member identity loaded."));
    } catch (error) {
      handleMemberProfileError(res, error);
    }
  },
);

export default memberProfileRouter;
