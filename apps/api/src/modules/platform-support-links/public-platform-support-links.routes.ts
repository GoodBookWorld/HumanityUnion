import { Router, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { PlatformSupportLinkPersistenceError } from "./platform-support-links.errors.js";
import { listPublicPlatformSupportLinks } from "./platform-support-links.service.js";

const publicPlatformSupportLinksRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

publicPlatformSupportLinksRouter.get("/", async (_req, res: Response) => {
  try {
    const result = await listPublicPlatformSupportLinks();
    res.json(createSuccessResponse(result, "Platform support links loaded."));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Platform support links request failed.";
    const status = error instanceof PlatformSupportLinkPersistenceError ? 503 : 500;
    res.status(status).json(createFailureResponse(message));
  }
});

export default publicPlatformSupportLinksRouter;
