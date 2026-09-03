import { Router, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import {
  LegalLocalizationPersistenceError,
  LegalLocalizationValidationError,
} from "./legal-localization.errors.js";
import { resolvePublishedLegalLocalization } from "./legal-localization.public.js";

const publicLegalLocalizationRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

function queryString(raw: unknown): string {
  if (typeof raw === "string") {
    return raw;
  }
  if (Array.isArray(raw)) {
    return String(raw[0] ?? "");
  }
  return "";
}

publicLegalLocalizationRouter.get("/", async (req, res: Response) => {
  try {
    const documentType = queryString(req.query.documentType);
    const locale = queryString(req.query.locale);

    if (!documentType.trim()) {
      throw new LegalLocalizationValidationError("documentType is required.");
    }
    if (!locale.trim()) {
      throw new LegalLocalizationValidationError("locale is required.");
    }

    const resolved = await resolvePublishedLegalLocalization(documentType, locale);
    res.json(createSuccessResponse(resolved, "Localized legal document resolved."));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Legal localization request failed.";
    const status =
      error instanceof LegalLocalizationValidationError
        ? 400
        : error instanceof LegalLocalizationPersistenceError
          ? 503
          : 500;
    res.status(status).json(createFailureResponse(message));
  }
});

export default publicLegalLocalizationRouter;
