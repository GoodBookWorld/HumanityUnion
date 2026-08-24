import { Router, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { PlatformSocialAccountPersistenceError } from "./platform-social-accounts.errors.js";
import { listPublicPlatformSocialAccounts } from "./platform-social-accounts.service.js";

const publicPlatformSocialAccountsRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

publicPlatformSocialAccountsRouter.get("/", async (_req, res: Response) => {
  try {
    const result = await listPublicPlatformSocialAccounts();
    res.json(createSuccessResponse(result, "Platform social accounts loaded."));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Platform social accounts request failed.";
    const status = error instanceof PlatformSocialAccountPersistenceError ? 503 : 500;
    res.status(status).json(createFailureResponse(message));
  }
});

export default publicPlatformSocialAccountsRouter;
