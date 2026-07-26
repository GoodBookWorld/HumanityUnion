import { Router, type Request } from "express";
import cookieParser from "cookie-parser";

import { createSuccessResponse } from "../../shared/http-response.js";
import { optionalAuthenticationMiddleware } from "../auth/auth.middleware.js";
import { getInitiativeById } from "./initiative.store.js";
import { canExposePublicInitiativeProjection } from "./public-initiative.projection.js";
import { buildPublicInitiativeExperienceProjection } from "./public-initiative-experience.service.js";

export const publicInitiativeExperienceRouter = Router();

publicInitiativeExperienceRouter.use(cookieParser());

const VISITOR_COOKIE = "hu_initiative_visitor";

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

function resolveViewerKey(req: Request): string {
  const existing = req.cookies?.[VISITOR_COOKIE];

  if (typeof existing === "string" && existing.length > 0) {
    return existing;
  }

  const generated = `viewer-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  req.res?.cookie(VISITOR_COOKIE, generated, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 365,
    path: "/",
  });

  return generated;
}

publicInitiativeExperienceRouter.get(
  "/:initiativeId/experience",
  optionalAuthenticationMiddleware,
  async (req, res) => {
    const initiative = getInitiativeById(resolveParam(req.params.initiativeId));

    if (!initiative || !canExposePublicInitiativeProjection(initiative)) {
      res.status(404).json(createFailureResponse("Initiative not found."));
      return;
    }

    const viewerKey = resolveViewerKey(req);
    const experience = await buildPublicInitiativeExperienceProjection({
      initiative,
      userId: req.auth?.id ?? null,
      viewerKey,
    });

    res.json(createSuccessResponse(experience, "Public initiative experience loaded."));
  },
);

export default publicInitiativeExperienceRouter;
