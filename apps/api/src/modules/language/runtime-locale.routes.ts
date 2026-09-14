/**
 * Production Completion Pack 02C Task 02 — public runtime locale endpoint.
 *
 * Lets Web SSR and clients obtain the canonical ResolvedRuntimeLocale using
 * cookie + Accept-Language + optional auth — without duplicating precedence.
 */

import { Router, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { runtimeLocaleMiddleware } from "./runtime-locale.middleware.js";

const runtimeLocaleRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

runtimeLocaleRouter.get("/", runtimeLocaleMiddleware, (req, res: Response) => {
  try {
    const locale = req.runtimeLocale;
    if (!locale) {
      res.status(500).json(createFailureResponse("Runtime locale was not resolved."));
      return;
    }
    res.json(createSuccessResponse(locale, "Runtime locale resolved."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Runtime locale request failed.";
    res.status(500).json(createFailureResponse(message));
  }
});

export default runtimeLocaleRouter;
