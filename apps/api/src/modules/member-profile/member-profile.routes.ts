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
  getMemberProfileStatisticsForUser,
  getMyPublicMemberProfilePreview,
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

/**
 * Profile UX Pack 02 Part 4/11 — dedicated, lightweight endpoint for the
 * three "Personal Statistics" cards on the Member Profile page, reusing
 * the exact same aggregation the Workspace Home statistics widget uses
 * (`participant-statistics.service.ts`). Deliberately its own endpoint
 * rather than piggy-backing on `/api/v1/workspace/home` so this page does
 * not have to load that heavier payload just for three numbers.
 */
memberProfileRouter.get(
  "/me/statistics",
  ...authenticatedWorkspaceWriteMiddleware,
  async (req, res) => {
    const userId = resolveAuthUserId(req);

    if (!userId) {
      res.status(401).json(createFailureResponse("Authentication required."));
      return;
    }

    try {
      const statistics = await getMemberProfileStatisticsForUser(userId);
      res.json(createSuccessResponse(statistics, "Member profile statistics loaded."));
    } catch (error) {
      handleMemberProfileError(res, error);
    }
  },
);

/**
 * Profile UX Pack 03.3 — powers the `/profile` "Public Profile Preview".
 * Additive, read-only endpoint: it returns the exact same
 * `PublicMemberProfile` shape the public `/member/{publicName}` route
 * returns for an authenticated non-owner viewer, plus `hiddenSections` so
 * the preview can explain a Privacy-hidden section without ever showing
 * public visitors that explanation. See `getMyPublicMemberProfilePreview`
 * for why no Privacy logic is duplicated here.
 */
memberProfileRouter.get(
  "/me/public-preview",
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

      const preview = await getMyPublicMemberProfilePreview(userId);
      res.json(createSuccessResponse(preview, "Public profile preview loaded."));
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
