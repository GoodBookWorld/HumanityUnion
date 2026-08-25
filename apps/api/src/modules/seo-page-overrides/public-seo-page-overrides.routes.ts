import { Router, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { SeoPageOverridePersistenceError } from "./seo-page-overrides.errors.js";
import { getPublicSeoPageOverride } from "./seo-page-overrides.service.js";

const publicSeoPageOverridesRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

publicSeoPageOverridesRouter.get("/:family/:entityKey", async (req, res: Response) => {
  try {
    const result = await getPublicSeoPageOverride({
      family: String(req.params.family ?? ""),
      entityKey: String(req.params.entityKey ?? ""),
    });
    res.json(createSuccessResponse(result, "Public SEO page override loaded."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "SEO page override request failed.";
    const status = error instanceof SeoPageOverridePersistenceError ? 503 : 500;
    res.status(status).json(createFailureResponse(message));
  }
});

export { publicSeoPageOverridesRouter };
