import { Router, type Response } from "express";

import { createSuccessResponse } from "../../../shared/http-response.js";
import { LanguageRegistryPersistenceError } from "./language-registry.errors.js";
import { listPublicLanguages } from "./language-registry.service.js";

const publicLanguagesRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

publicLanguagesRouter.get("/", async (_req, res: Response) => {
  try {
    const result = await listPublicLanguages();
    res.json(createSuccessResponse(result, "Languages loaded."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Languages request failed.";
    const status = error instanceof LanguageRegistryPersistenceError ? 503 : 500;
    res.status(status).json(createFailureResponse(message));
  }
});

export default publicLanguagesRouter;
