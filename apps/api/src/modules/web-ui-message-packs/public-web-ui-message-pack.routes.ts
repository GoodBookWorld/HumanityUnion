import { Router, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { WebUiMessagePackPersistenceError } from "./web-ui-message-pack.errors.js";
import {
  getPublishedWebUiRuntimeEvidence,
  getPublishedWebUiRuntimePayload,
} from "./web-ui-message-pack.repository.js";

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

function singleQueryValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return String(value[0] ?? "");
  }
  return "";
}

/**
 * Public read — published packs only (browser SSR / next-intl remote source).
 * GET /api/v1/web-ui-message-packs?locale=
 * GET /api/v1/web-ui-message-packs?locale=&view=evidence
 */
publicWebUiMessagePackRouter.get("/", async (req, res: Response) => {
  try {
    const locale = singleQueryValue(req.query.locale);
    const view = singleQueryValue(req.query.view).trim();

    if (!locale.trim()) {
      res.status(400).json(createFailureResponse("locale query parameter is required."));
      return;
    }
    if (view.length > 0 && view !== "evidence") {
      res.status(400).json(createFailureResponse("view must be evidence."));
      return;
    }

    if (view === "evidence") {
      const evidence = await getPublishedWebUiRuntimeEvidence(locale);
      if (!evidence) {
        res.status(404).json(createFailureResponse("Published WEB_UI message pack not found."));
        return;
      }
      res.json(
        createSuccessResponse(
          {
            locale: evidence.locale,
            revision: evidence.revision,
            topLevelKeyCount: evidence.topLevelKeyCount,
          },
          "Published WEB_UI message pack evidence loaded.",
        ),
      );
      return;
    }

    const pack = await getPublishedWebUiRuntimePayload(locale);
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
          source: pack.source,
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
