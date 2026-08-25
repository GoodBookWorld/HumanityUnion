import { Router } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { MemberProfilePersistenceUnavailableError } from "../member-profile/member-profile.errors.js";
import {
  listPublicSitemapInitiatives,
  listPublicSitemapParticipantProfiles,
} from "./public-sitemap.service.js";

const publicSitemapRouter = Router();

publicSitemapRouter.get("/initiatives", (_req, res) => {
  const entries = listPublicSitemapInitiatives();

  res.setHeader("Cache-Control", "no-store");
  res.json(
    createSuccessResponse(
      { entries },
      "Public sitemap initiative inventory loaded.",
      { total: entries.length },
    ),
  );
});

/**
 * SEO Pack 11 — minimal public Participant Profile inventory for sitemap.
 * Only active profiles with profileVisibility === "public" are returned.
 */
publicSitemapRouter.get("/participant-profiles", async (_req, res) => {
  try {
    const entries = await listPublicSitemapParticipantProfiles();

    res.setHeader("Cache-Control", "no-store");
    res.json(
      createSuccessResponse(
        { entries },
        "Public sitemap participant profile inventory loaded.",
        { total: entries.length },
      ),
    );
  } catch (error) {
    if (error instanceof MemberProfilePersistenceUnavailableError) {
      res.status(503).json({
        success: false,
        data: null,
        meta: {},
        links: {},
        message: "Participant profile inventory is temporarily unavailable.",
      });
      return;
    }

    console.error(
      "public_sitemap.participant_profiles_failed",
      error instanceof Error ? error.message : "unknown_error",
    );
    res.status(500).json({
      success: false,
      data: null,
      meta: {},
      links: {},
      message: "Participant profile inventory could not be loaded.",
    });
  }
});

export default publicSitemapRouter;
