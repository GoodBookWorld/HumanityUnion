import { Router, type Request, type Response } from "express";
import cookieParser from "cookie-parser";

import type { InitiativeSupportSignalKind } from "@hu/types";
import { INITIATIVE_SUPPORT_TRANSPARENCY_NOTE } from "@hu/types";

import { createSuccessResponse } from "../../shared/http-response.js";
import { logger } from "../../shared/observability/logger.js";
import {
  optionalAuthenticationMiddleware,
  requireJwtAuthenticationMiddleware,
} from "../auth/auth.middleware.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { canExposePublicInitiativeProjection } from "../initiatives/public-initiative.projection.js";
import {
  getInitiativeSupportStatistics,
  recordInitiativeView,
  setInitiativeSupportSignal,
  setVisitorInitiativeSupportSignal,
  toggleInitiativeBookmark,
} from "./initiative-support.service.js";

export const initiativeSupportRouter = Router();

initiativeSupportRouter.use(cookieParser());

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

function resolveInitiativeOr404(initiativeId: string, res: Response) {
  const initiative = getInitiativeById(initiativeId);

  if (!initiative || !canExposePublicInitiativeProjection(initiative)) {
    res.status(404).json(createFailureResponse("Initiative not found."));
    return null;
  }

  return initiative;
}

function resolveVisitorKey(req: Request): string {
  const existing = req.cookies?.[VISITOR_COOKIE];

  if (typeof existing === "string" && existing.length > 0) {
    return existing;
  }

  const generated = `visitor-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  req.res?.cookie(VISITOR_COOKIE, generated, {
    httpOnly: true,
    sameSite: "lax",
    // Pack 26A — Secure on production HTTPS; omit for local HTTP development.
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 24 * 365,
    path: "/",
  });

  return generated;
}

function parseSignal(value: unknown): InitiativeSupportSignalKind | null {
  if (value === "like" || value === "dislike" || value === "none") {
    return value;
  }

  return null;
}

initiativeSupportRouter.get(
  "/:initiativeId/support",
  optionalAuthenticationMiddleware,
  async (req, res) => {
    const initiative = resolveInitiativeOr404(resolveParam(req.params.initiativeId), res);

    if (!initiative) {
      return;
    }

    const stats = await getInitiativeSupportStatistics({
      initiativeId: initiative.initiativeId,
      userId: req.auth?.id ?? null,
      visitorKeyValue: req.auth?.id ? null : resolveVisitorKey(req),
    });

    res.json(
      createSuccessResponse(
        {
          ...stats,
          transparencyNote: INITIATIVE_SUPPORT_TRANSPARENCY_NOTE,
        },
        "Initiative support statistics loaded.",
      ),
    );
  },
);

initiativeSupportRouter.post(
  "/:initiativeId/support/signal",
  optionalAuthenticationMiddleware,
  async (req, res) => {
    const initiative = resolveInitiativeOr404(resolveParam(req.params.initiativeId), res);

    if (!initiative) {
      return;
    }

    const signal = parseSignal(req.body?.signal);

    if (!signal) {
      res.status(400).json(createFailureResponse("Signal must be like, dislike, or none."));
      return;
    }

    let currentUserSignal: InitiativeSupportSignalKind;

    if (req.auth?.id) {
      currentUserSignal = await setInitiativeSupportSignal({
        initiativeId: initiative.initiativeId,
        userId: req.auth.id,
        signal,
      });
    } else {
      currentUserSignal = await setVisitorInitiativeSupportSignal({
        initiativeId: initiative.initiativeId,
        visitorKeyValue: resolveVisitorKey(req),
        signal,
      });
    }

    const stats = await getInitiativeSupportStatistics({
      initiativeId: initiative.initiativeId,
      userId: req.auth?.id ?? null,
      visitorKeyValue: req.auth?.id ? null : resolveVisitorKey(req),
    });

    res.json(
      createSuccessResponse(
        {
          ...stats,
          currentUserSignal,
          transparencyNote: INITIATIVE_SUPPORT_TRANSPARENCY_NOTE,
        },
        "Initiative support signal updated.",
      ),
    );
  },
);

initiativeSupportRouter.post(
  "/:initiativeId/support/bookmark",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    const initiative = resolveInitiativeOr404(resolveParam(req.params.initiativeId), res);
    const userId = req.auth?.id;

    if (!initiative || !userId) {
      if (!userId) {
        res.status(401).json(createFailureResponse("Authentication required."));
      }

      return;
    }

    const bookmarked = await toggleInitiativeBookmark({
      initiativeId: initiative.initiativeId,
      userId,
    });

    const stats = await getInitiativeSupportStatistics({
      initiativeId: initiative.initiativeId,
      userId,
    });

    res.json(
      createSuccessResponse(
        {
          ...stats,
          currentUserBookmarked: bookmarked,
          transparencyNote: INITIATIVE_SUPPORT_TRANSPARENCY_NOTE,
        },
        bookmarked ? "Initiative bookmarked." : "Initiative bookmark removed.",
      ),
    );
  },
);

initiativeSupportRouter.post("/:initiativeId/support/view", async (req, res) => {
  const initiative = resolveInitiativeOr404(resolveParam(req.params.initiativeId), res);

  if (!initiative) {
    return;
  }

  const viewerKey =
    typeof req.body?.viewerKey === "string" && req.body.viewerKey.length > 0
      ? req.body.viewerKey
      : resolveVisitorKey(req);

  try {
    const total = await recordInitiativeView({
      initiativeId: initiative.initiativeId,
      viewerKey,
    });

    res.json(
      createSuccessResponse(
        {
          total,
          available: true,
        },
        "Initiative view recorded.",
      ),
    );
  } catch (error) {
    // Stability Hotfix: `recordInitiativeView` is idempotent for the
    // expected duplicate-view race, so a rejection here is a genuine,
    // unexpected persistence failure (e.g. a real Mongo outage) — this
    // route has no global async-error middleware, so without this
    // try/catch an unawaited-by-Express rejection would become an
    // unhandled rejection and could terminate the process, exactly as it
    // did for the fire-and-forget call in
    // buildPublicInitiativeExperienceProjection.
    logger.error("initiative_view.record_failed", {
      initiativeId: initiative.initiativeId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json(createFailureResponse("Unable to record Initiative view."));
  }
});

export default initiativeSupportRouter;
