import { Router, type Response } from "express";

/** @deprecated Legacy initiative-centric Workspace home. Canonical MVP read model: GET /api/v1/workspace */

import { createSuccessResponse } from "../../shared/http-response.js";
import { requireJwtAuthenticationMiddleware } from "../auth/auth.middleware.js";
import { AuthenticationRequiredError } from "../auth/auth.errors.js";
import { getMemberById } from "../member/member-access.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";
import { buildAlliesSummary, getWorkspaceHomeForParticipant } from "./workspace-home.service.js";

const workspaceHomeRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

workspaceHomeRouter.get("/home", requireJwtAuthenticationMiddleware, async (req, res: Response) => {
  if (!req.auth?.id) {
    res.status(401).json(createFailureResponse("Authentication required."));
    return;
  }

  try {
    const identity = await resolveRequestIdentity(req);
    const member = req.auth.memberId ? await getMemberById(req.auth.memberId) : null;
    const displayName = member?.profile.displayName ?? req.auth.email.split("@")[0] ?? "Member";

    const home = await getWorkspaceHomeForParticipant({
      identity,
      userId: req.auth.id,
      displayName,
    });

    res.json(createSuccessResponse(home, "Workspace home loaded."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Workspace home request failed.";
    res
      .status(error instanceof AuthenticationRequiredError ? 401 : 500)
      .json(createFailureResponse(message));
  }
});

/**
 * Communication UX Pack 03.3.1 Part 4/11 — the Workspace Messages "Active
 * Allies" panel's dedicated read. Reuses the exact same `buildAlliesSummary`
 * aggregation as the full `/home` payload above (no duplicate service,
 * projection, or query), but as its own small route so the Messages page
 * never has to run every unrelated `/home` query (initiatives, decision
 * sessions, statistics, etc.) just to render this one panel.
 */
workspaceHomeRouter.get(
  "/home/allies",
  requireJwtAuthenticationMiddleware,
  async (req, res: Response) => {
    if (!req.auth?.id) {
      res.status(401).json(createFailureResponse("Authentication required."));
      return;
    }

    try {
      const identity = await resolveRequestIdentity(req);
      const allies = await buildAlliesSummary(identity.participantId);

      res.json(createSuccessResponse(allies, "Active Allies loaded."));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Active Allies request failed.";
      res
        .status(error instanceof AuthenticationRequiredError ? 401 : 500)
        .json(createFailureResponse(message));
    }
  },
);

export default workspaceHomeRouter;
