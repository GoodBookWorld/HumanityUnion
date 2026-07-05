import { Router } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import {
  buildCommunityLatestInitiativesProjection,
  listPublicProjectionCommunitySlugs,
} from "./initiative-public-projection.access.js";

const publicLatestInitiativesRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

publicLatestInitiativesRouter.get("/communities", (_req, res) => {
  res.json(
    createSuccessResponse(
      listPublicProjectionCommunitySlugs(),
      "Public projection community slugs loaded.",
    ),
  );
});

publicLatestInitiativesRouter.get("/communities/:communitySlug/latest-initiatives", (req, res) => {
  const communitySlug = Array.isArray(req.params.communitySlug)
    ? (req.params.communitySlug[0] ?? "")
    : (req.params.communitySlug ?? "");

  const projection = buildCommunityLatestInitiativesProjection(communitySlug);

  if (!projection) {
    res.status(404).json(createFailureResponse("Community latest initiatives not found."));
    return;
  }

  res.json(createSuccessResponse(projection, "Community latest initiatives projection loaded."));
});

export default publicLatestInitiativesRouter;
