import { Router } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { optionalAuthenticationMiddleware } from "../auth/auth.middleware.js";
import { attachRuntimeLocale } from "../language/runtime-locale.middleware.js";
import {
  MemberProfileAccessDeniedError,
  MemberProfileNotFoundError,
  MemberProfilePersistenceUnavailableError,
} from "./member-profile.errors.js";
import { getPublicMemberProfileById, getPublicMemberProfileByPublicName } from "./member-profile.service.js";

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

function readPresentationLocaleQuery(
  req: Parameters<typeof attachRuntimeLocale>[0],
): string {
  const raw = req.query.locale;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" ? value.trim() : "";
}

async function resolveRequestPresentationLocale(
  req: Parameters<typeof attachRuntimeLocale>[0],
): Promise<string> {
  const queryLocale = readPresentationLocaleQuery(req);
  if (queryLocale) {
    return queryLocale;
  }
  const headerRaw = req.headers["x-hu-presentation-locale"];
  const headerLocale = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;
  if (typeof headerLocale === "string" && headerLocale.trim()) {
    return headerLocale.trim();
  }
  const runtime = await attachRuntimeLocale(req);
  return runtime.locale;
}

/**
 * UX Evolution Pack 02.4 Part 6 — the actual public-facing route:
 * `/member/{publicName}` (comment author links, Initiative steward links)
 * resolves here, by the human-readable `publicName`, not by the opaque
 * `profileId` the `/:profileId` route below expects. Declared before
 * `/:profileId` for readability; the two-segment path never collides with
 * the single-segment one regardless of order.
 */
publicMemberProfileRouter.get(
  "/by-name/:publicName",
  optionalAuthenticationMiddleware,
  async (req, res) => {
    const publicName = Array.isArray(req.params.publicName)
      ? (req.params.publicName[0] ?? "")
      : (req.params.publicName ?? "");

    const viewerIsAuthenticated = Boolean(req.auth?.memberId);
    const viewerUserId = req.auth?.id;
    const viewerParticipantId = req.auth?.memberId;

    try {
      const locale = await resolveRequestPresentationLocale(req);
      const profile = await getPublicMemberProfileByPublicName(publicName, {
        viewerIsAuthenticated,
        viewerUserId,
        viewerParticipantId,
        locale,
      });

      res.json(createSuccessResponse(profile, "Public member profile loaded."));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Public member profile request failed.";
      res.status(resolvePublicMemberProfileErrorStatus(error)).json(createFailureResponse(message));
    }
  },
);

publicMemberProfileRouter.get("/:profileId", optionalAuthenticationMiddleware, async (req, res) => {
  const profileId = Array.isArray(req.params.profileId)
    ? (req.params.profileId[0] ?? "")
    : (req.params.profileId ?? "");

  const viewerIsAuthenticated = Boolean(req.auth?.memberId);
  const viewerUserId = req.auth?.id;
  const viewerParticipantId = req.auth?.memberId;

  try {
    const locale = await resolveRequestPresentationLocale(req);
    const profile = await getPublicMemberProfileById(profileId, {
      viewerIsAuthenticated,
      viewerUserId,
      viewerParticipantId,
      locale,
    });

    res.json(createSuccessResponse(profile, "Public member profile loaded."));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Public member profile request failed.";
    res.status(resolvePublicMemberProfileErrorStatus(error)).json(createFailureResponse(message));
  }
});

export default publicMemberProfileRouter;
