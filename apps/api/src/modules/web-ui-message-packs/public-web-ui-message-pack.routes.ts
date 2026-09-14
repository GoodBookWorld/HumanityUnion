import { Router, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { WebUiMessagePackPersistenceError } from "./web-ui-message-pack.errors.js";
import { getPublishedWebUiMessagePackByLocale } from "./web-ui-message-pack.repository.js";

const publicWebUiMessagePackRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

/**
 * Public read — published packs only (browser SSR / next-intl remote source).
 * GET /api/v1/web-ui-message-packs?locale=
 */
publicWebUiMessagePackRouter.get("/", async (req, res: Response) => {
  try {
    const localeParam = req.query.locale;
    const locale =
      typeof localeParam === "string"
        ? localeParam
        : Array.isArray(localeParam)
          ? String(localeParam[0] ?? "")
          : "";

    if (!locale.trim()) {
      res.status(400).json(createFailureResponse("locale query parameter is required."));
      return;
    }

    const pack = await getPublishedWebUiMessagePackByLocale(locale);
    if (!pack) {
      res.status(404).json(createFailureResponse("Published WEB_UI message pack not found."));
      return;
    }

    res.json(
      createSuccessResponse(
        {
          locale: pack.locale,
          revision: pack.revision,
          messages: pack.messages,
          source: "remote" as const,
        },
        "Published WEB_UI message pack loaded.",
      ),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "WEB_UI message pack request failed.";
    const status = error instanceof WebUiMessagePackPersistenceError ? 503 : 500;
    res.status(status).json(createFailureResponse(message));
  }
});

export default publicWebUiMessagePackRouter;
