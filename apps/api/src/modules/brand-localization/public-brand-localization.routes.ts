import { Router, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { BrandLocalizationPersistenceError } from "./brand-localization.errors.js";
import {
  listPublishedBrandLocalizationSummaries,
  resolveLocalizedBrand,
} from "./brand-localization.public.js";

const publicBrandLocalizationRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

publicBrandLocalizationRouter.get("/", async (req, res: Response) => {
  try {
    const localeParam = req.query.locale;
    const locale =
      typeof localeParam === "string"
        ? localeParam
        : Array.isArray(localeParam)
          ? String(localeParam[0] ?? "")
          : "";

    if (locale.trim()) {
      const resolved = await resolveLocalizedBrand(locale);
      res.json(createSuccessResponse(resolved, "Localized brand resolved."));
      return;
    }

    const brands = await listPublishedBrandLocalizationSummaries();
    res.json(createSuccessResponse({ brands }, "Published brand localizations loaded."));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Brand localization request failed.";
    const status = error instanceof BrandLocalizationPersistenceError ? 503 : 500;
    res.status(status).json(createFailureResponse(message));
  }
});

export default publicBrandLocalizationRouter;
